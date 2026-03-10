"""
Multi-match search query parser.

Syntax:
  +  AND (all terms must match)
  |  OR  (any term matches)
  () grouping

Precedence: AND binds tighter than OR.
  a|b+c  ->  a OR (b AND c)
  (a|b)+c -> (a OR b) AND c

Terms are matched against merchant, description, raw_description (case-insensitive contains).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Union


@dataclass
class TermNode:
    """A single search term."""

    value: str


@dataclass
class AndNode:
    """AND: both sides must match."""

    left: SearchNode
    right: SearchNode


@dataclass
class OrNode:
    """OR: either side may match."""

    left: SearchNode
    right: SearchNode


SearchNode = Union[TermNode, AndNode, OrNode]


class ParseError(Exception):
    """Raised when the query string cannot be parsed."""

    pass


def _is_operator(c: str) -> bool:
    return c in ("+", "|")


def _is_bracket(c: str) -> bool:
    return c in ("(", ")")


def _skip_whitespace(s: str, pos: int) -> int:
    while pos < len(s) and s[pos].isspace():
        pos += 1
    return pos


def _read_term(s: str, pos: int) -> tuple[str, int]:
    """Read a term (non-operator, non-bracket chars). Handles quoted strings."""
    start = pos
    if pos < len(s) and s[pos] == '"':
        pos += 1
        while pos < len(s) and s[pos] != '"':
            pos += 1
        if pos < len(s):
            pos += 1
        return s[start + 1 : pos - 1], pos

    while pos < len(s) and not _is_operator(s[pos]) and not _is_bracket(s[pos]):
        pos += 1
    return s[start:pos].strip(), pos


def _parse_or(s: str, pos: int) -> tuple[SearchNode, int]:
    left, pos = _parse_and(s, pos)
    pos = _skip_whitespace(s, pos)
    while pos < len(s) and s[pos] == "|":
        pos += 1
        pos = _skip_whitespace(s, pos)
        right, pos = _parse_and(s, pos)
        left = OrNode(left=left, right=right)
        pos = _skip_whitespace(s, pos)
    return left, pos


def _parse_and(s: str, pos: int) -> tuple[SearchNode, int]:
    left, pos = _parse_term_or_group(s, pos)
    pos = _skip_whitespace(s, pos)
    while pos < len(s) and s[pos] == "+":
        pos += 1
        pos = _skip_whitespace(s, pos)
        right, pos = _parse_term_or_group(s, pos)
        left = AndNode(left=left, right=right)
        pos = _skip_whitespace(s, pos)
    return left, pos


def _parse_term_or_group(s: str, pos: int) -> tuple[SearchNode, int]:
    pos = _skip_whitespace(s, pos)
    if pos >= len(s):
        raise ParseError("Unexpected end of query")
    if s[pos] == "(":
        pos += 1
        inner, pos = _parse_or(s, pos)
        pos = _skip_whitespace(s, pos)
        if pos >= len(s) or s[pos] != ")":
            raise ParseError("Unclosed parenthesis")
        pos += 1
        return inner, pos
    term, pos = _read_term(s, pos)
    if not term:
        raise ParseError("Empty term")
    return TermNode(value=term), pos


def parse_search_query(q: str) -> SearchNode | None:
    """
    Parse a search query string into an expression tree.

    Returns None if the query is empty or only whitespace.
    Raises ParseError on invalid syntax.
    """
    q = (q or "").strip()
    if not q:
        return None
    node, pos = _parse_or(q, 0)
    pos = _skip_whitespace(q, pos)
    if pos < len(q):
        raise ParseError(f"Unexpected character at position {pos}")
    return node


def _transaction_matches_term(
    merchant: str, description: str, raw_description: str, term: str
) -> bool:
    """Check if a term matches any of merchant/description/raw_description (case-insensitive contains)."""
    t = (term or "").strip().lower()
    if not t:
        return True
    haystacks = [
        (merchant or "").lower(),
        (description or "").lower(),
        (raw_description or "").lower(),
    ]
    return any(t in h for h in haystacks)


def transaction_matches_keywords(
    merchant: str, description: str, raw_description: str, keywords: str
) -> bool:
    """
    Check if a transaction's fields match the parsed keyword query.

    merchant, description, raw_description: transaction fields
    keywords: search query string (same syntax as transaction search: + | ())

    Returns True if the query is empty or matches. Returns False on parse error.
    """
    parsed = parse_search_query(keywords)
    if parsed is None:
        return True

    def eval_node(node: SearchNode) -> bool:
        if isinstance(node, TermNode):
            return _transaction_matches_term(
                merchant, description, raw_description, node.value
            )
        if isinstance(node, AndNode):
            return eval_node(node.left) and eval_node(node.right)
        if isinstance(node, OrNode):
            return eval_node(node.left) or eval_node(node.right)
        return False

    try:
        return eval_node(parsed)
    except ParseError:
        return False


def build_search_filter(node: SearchNode, term_to_filter):
    """
    Convert a parsed SearchNode tree to a SQLAlchemy filter expression.

    term_to_filter: callable(str) -> SQLAlchemy column expression
        Given a term string, returns the filter for that term (e.g. OR across
        merchant/description/raw_description).
    """
    from sqlalchemy import and_, or_

    if isinstance(node, TermNode):
        return term_to_filter(node.value)
    if isinstance(node, AndNode):
        return and_(
            build_search_filter(node.left, term_to_filter),
            build_search_filter(node.right, term_to_filter),
        )
    if isinstance(node, OrNode):
        return or_(
            build_search_filter(node.left, term_to_filter),
            build_search_filter(node.right, term_to_filter),
        )
    raise ValueError(f"Unknown node type: {type(node)}")
