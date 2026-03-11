from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.person import Person
from app.schemas.person import PersonCreate, PersonRead, PersonUpdate

router = APIRouter(prefix="/api/persons", tags=["persons"])


@router.get("/", response_model=list[PersonRead])
def list_persons(db: Session = Depends(get_db)):
    return db.query(Person).order_by(Person.name.asc()).all()


@router.post("/", response_model=PersonRead, status_code=201)
def create_person(payload: PersonCreate, db: Session = Depends(get_db)):
    exists = db.query(Person.id).filter(Person.name == payload.name).first()
    if exists:
        raise HTTPException(status_code=409, detail="Person name already exists")
    p = Person(name=payload.name, icon_id=payload.icon_id)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/{person_id}", response_model=PersonRead)
def update_person(person_id: int, payload: PersonUpdate, db: Session = Depends(get_db)):
    p = db.get(Person, person_id)
    if not p:
        raise HTTPException(status_code=404, detail="Person not found")
    exists = (
        db.query(Person.id)
        .filter(Person.name == payload.name, Person.id != person_id)
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="Person name already exists")
    p.name = payload.name
    p.icon_id = payload.icon_id
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{person_id}", status_code=204)
def delete_person(person_id: int, db: Session = Depends(get_db)):
    p = db.get(Person, person_id)
    if not p:
        raise HTTPException(status_code=404, detail="Person not found")
    db.delete(p)
    db.commit()

