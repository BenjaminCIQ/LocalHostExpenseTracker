import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, type Person } from "@/lib/api";
import PersonIcon from "@/components/icons/PersonIcon";
import { PERSON_ICONS } from "@/lib/personIcons";

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newIconId, setNewIconId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editIconId, setEditIconId] = useState<string | null>(null);

  const load = async () => {
    try {
      setPeople(await api.getPersons());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load people");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    if (!newName.trim()) return;
    try {
      await api.createPerson({ name: newName.trim(), icon_id: newIconId });
      setNewName("");
      setNewIconId(null);
      await load();
      window.dispatchEvent(new Event("people-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  };

  const startEdit = (p: Person) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditIconId(p.icon_id ?? null);
  };

  const save = async () => {
    if (!editingId) return;
    if (!editName.trim()) return;
    try {
      await api.updatePerson(editingId, { name: editName.trim(), icon_id: editIconId });
      setEditingId(null);
      setEditName("");
      setEditIconId(null);
      await load();
      window.dispatchEvent(new Event("people-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this person? Accounts can be reassigned later.")) return;
    try {
      await api.deletePerson(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">People</h2>
      {error && <p className="text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Add person</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="min-w-[240px]">
                <label className="text-sm text-muted-foreground">Name</label>
                <input
                  className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  placeholder="e.g. Spouse"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <Button onClick={create} disabled={!newName.trim()}>
                Add
              </Button>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Icon</label>
              <div className="mt-1 flex flex-wrap gap-1">
                {PERSON_ICONS.map(({ id, emoji, label }) => (
                  <button
                    key={id}
                    type="button"
                    title={label}
                    onClick={() => setNewIconId(newIconId === id ? null : id)}
                    className={`rounded-md p-1.5 text-lg transition-colors ${
                      newIconId === id ? "bg-primary/20 ring-1 ring-primary/40" : "hover:bg-muted"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>People</CardTitle>
        </CardHeader>
        <CardContent>
          {people.length === 0 ? (
            <p className="text-muted-foreground">No people yet.</p>
          ) : (
            <div className="space-y-2">
              {people.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border p-3"
                >
                  {editingId === p.id ? (
                    <div className="flex flex-col gap-3 w-full">
                      <div className="flex items-center gap-2">
                        <input
                          className="flex-1 min-w-0 h-9 rounded-md border border-border bg-background px-3 text-sm"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                        <Button onClick={save} disabled={!editName.trim()}>
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingId(null);
                            setEditName("");
                            setEditIconId(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Icon</label>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {PERSON_ICONS.map(({ id, emoji, label }) => (
                            <button
                              key={id}
                              type="button"
                              title={label}
                              onClick={() => setEditIconId(editIconId === id ? null : id)}
                              className={`rounded-md p-1.5 text-lg transition-colors ${
                                editIconId === id ? "bg-primary/20 ring-1 ring-primary/40" : "hover:bg-muted"
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <PersonIcon iconId={p.icon_id} className="h-5 w-5 shrink-0" />
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">#{p.id}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => startEdit(p)}>
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => remove(p.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

