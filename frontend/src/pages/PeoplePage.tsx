import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, type Person } from "@/lib/api";

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

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
      await api.createPerson({ name: newName.trim() });
      setNewName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  };

  const startEdit = (p: Person) => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const save = async () => {
    if (!editingId) return;
    if (!editName.trim()) return;
    try {
      await api.updatePerson(editingId, { name: editName.trim() });
      setEditingId(null);
      setEditName("");
      await load();
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
                    <div className="flex items-center gap-2 w-full">
                      <input
                        className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
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
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">#{p.id}</div>
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

