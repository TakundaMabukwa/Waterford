"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Mail, Phone, Plus, Search, User2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SecureButton } from "@/components/SecureButton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ClientRecord = {
  id: number;
  name?: string | null;
  client_id?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  industry?: string | null;
  credit_limit?: number | null;
  dormant_flag?: boolean | null;
  postal_code?: string | null;
  fax_number?: string | null;
  registration_number?: string | null;
  registration_name?: string | null;
  ck_number?: string | null;
  tax_number?: string | null;
  vat_number?: string | null;
  operating_hours?: string | null;
  capacity?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type ClientFormState = {
  name: string;
  client_id: string;
  address: string;
  city: string;
  state: string;
  country: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  email: string;
  phone: string;
  industry: string;
  credit_limit: string;
  status: string;
  postal_code: string;
  registration_number: string;
  registration_name: string;
  ck_number: string;
  tax_number: string;
  vat_number: string;
  fax_number: string;
  operating_hours: string;
  capacity: string;
  notes: string;
};

const defaultFormState: ClientFormState = {
  name: "",
  client_id: "",
  address: "",
  city: "",
  state: "",
  country: "",
  contact_person: "",
  contact_phone: "",
  contact_email: "",
  email: "",
  phone: "",
  industry: "",
  credit_limit: "",
  status: "Active",
  postal_code: "",
  registration_number: "",
  registration_name: "",
  ck_number: "",
  tax_number: "",
  vat_number: "",
  fax_number: "",
  operating_hours: "",
  capacity: "",
  notes: "",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [formState, setFormState] = useState<ClientFormState>(defaultFormState);

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/eps-client-list", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load clients");
      }

      setClients(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      console.error("Failed to load clients:", error);
      toast.error("Could not load clients right now");
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return clients;

    return clients.filter((client) =>
      [
        client.client_id,
        client.name,
        client.contact_person,
        client.contact_phone,
        client.contact_email,
        client.email,
        client.phone,
        client.address,
        client.city,
        client.country,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [clients, search]);

  const activeClients = filteredClients.filter((client) => client.status !== "Inactive").length;
  const dormantClients = filteredClients.filter((client) => Boolean(client.dormant_flag)).length;

  const updateField = (field: keyof ClientFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const openCreateClient = () => {
    setEditingClientId(null);
    setFormState(defaultFormState);
    setIsAddOpen(true);
  };

  const openEditClient = (client: ClientRecord) => {
    setEditingClientId(client.id);
    setFormState({
      name: client.name || "",
      client_id: client.client_id || "",
      address: client.address || "",
      city: client.city || "",
      state: client.state || "",
      country: client.country || "",
      contact_person: client.contact_person || "",
      contact_phone: client.contact_phone || "",
      contact_email: client.contact_email || "",
      email: client.email || "",
      phone: client.phone || "",
      industry: client.industry || "",
      credit_limit: client.credit_limit?.toString() || "",
      status: client.status || "Active",
      postal_code: client.postal_code || "",
      registration_number: client.registration_number || "",
      registration_name: client.registration_name || "",
      ck_number: client.ck_number || "",
      tax_number: client.tax_number || "",
      vat_number: client.vat_number || "",
      fax_number: client.fax_number || "",
      operating_hours: client.operating_hours || "",
      capacity: client.capacity || "",
      notes: client.notes || "",
    });
    setIsAddOpen(true);
  };

  const closeForm = () => {
    setIsAddOpen(false);
    setEditingClientId(null);
    setFormState(defaultFormState);
  };

  const handleSaveClient = async () => {
    if (!formState.name.trim() && !formState.client_id.trim()) {
      toast.error("Enter at least a client name or client ID");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/eps-client-list", {
        method: editingClientId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingClientId ? { id: editingClientId, ...formState } : formState
        ),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to save client");
      }

      toast.success(editingClientId ? "Client updated successfully" : "Client added successfully");
      closeForm();
      await fetchClients();
    } catch (error) {
      console.error("Failed to save client:", error);
      toast.error("Could not save client right now");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-[calc(100vw-8rem)] space-y-6 overflow-x-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-slate-600">View, add, and update client records used in Load Plan.</p>
        </div>
        <SecureButton page="clients" action="create" onClick={openCreateClient}>
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </SecureButton>
      </div>

      <div className="grid w-full min-w-0 gap-4 md:grid-cols-3">
        <Card className="min-w-0">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500">Total Clients</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{clients.length}</div>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500">Active</div>
            <div className="mt-2 text-3xl font-bold text-emerald-600">{activeClients}</div>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardContent className="pt-6">
            <div className="text-sm text-slate-500">Dormant</div>
            <div className="mt-2 text-3xl font-bold text-amber-600">{dormantClients}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="w-full min-w-0 max-w-full overflow-hidden">
        <CardHeader className="gap-4">
          <CardTitle>Client List</CardTitle>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by client ID, name, contact, or address..."
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-lg border border-slate-200">
            <Table className="min-w-[1080px] table-auto">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="min-w-[180px]">Client ID</TableHead>
                  <TableHead className="min-w-[220px]">Name</TableHead>
                  <TableHead className="min-w-[180px]">Contact</TableHead>
                  <TableHead className="min-w-[240px]">Phone / Email</TableHead>
                  <TableHead className="min-w-[320px]">Address</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="min-w-[110px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-28 text-center text-slate-500">
                      Loading clients...
                    </TableCell>
                  </TableRow>
                ) : filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-28 text-center text-slate-500">
                      No client rows found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="align-top">
                        <div className="max-w-[180px] whitespace-normal break-words font-medium text-slate-900">
                          {client.client_id || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex max-w-[220px] flex-col whitespace-normal break-words">
                          <span className="font-medium text-slate-900">{client.name || "-"}</span>
                          {client.industry ? (
                            <span className="text-xs text-slate-500">{client.industry}</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex max-w-[180px] items-start gap-2 whitespace-normal break-words text-sm text-slate-700">
                          <User2 className="mt-0.5 h-4 w-4 text-slate-400" />
                          <span>{client.contact_person || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="max-w-[240px] space-y-2 text-sm text-slate-700">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="whitespace-normal break-words">
                              {client.contact_phone || client.phone || "-"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="whitespace-normal break-words">
                              {client.contact_email || client.email || "-"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex max-w-[320px] items-start gap-2 text-sm text-slate-700">
                          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <span className="whitespace-normal break-words">
                            {[
                              client.address,
                              client.city,
                              client.state,
                              client.country,
                            ]
                              .filter(Boolean)
                              .join(", ") || "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge
                          className={
                            client.status === "Active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-700"
                          }
                        >
                          {client.status || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <SecureButton
                          page="clients"
                          action="edit"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditClient(client)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </SecureButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet
        open={isAddOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeForm();
            return;
          }
          setIsAddOpen(true);
        }}
      >
        <SheetContent className="w-[920px] max-w-[96vw] overflow-y-auto px-0">
          <SheetHeader className="border-b border-slate-200 px-6 py-5">
            <SheetTitle>{editingClientId ? "Edit Client" : "Add Client"}</SheetTitle>
          </SheetHeader>

          <div className="space-y-8 px-6 py-6">
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Basic Details</h3>
                <p className="text-xs text-slate-500">Core client identity and location details.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Client Name</Label>
                  <Input value={formState.name} onChange={(e) => updateField("name", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Client ID</Label>
                  <Input value={formState.client_id} onChange={(e) => updateField("client_id", e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Address</Label>
                  <Input value={formState.address} onChange={(e) => updateField("address", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">City</Label>
                  <Input value={formState.city} onChange={(e) => updateField("city", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">State</Label>
                  <Input value={formState.state} onChange={(e) => updateField("state", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Country</Label>
                  <Input value={formState.country} onChange={(e) => updateField("country", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Status</Label>
                  <Input value={formState.status} onChange={(e) => updateField("status", e.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Contacts</h3>
                <p className="text-xs text-slate-500">Primary people and communication channels.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Contact Person</Label>
                  <Input value={formState.contact_person} onChange={(e) => updateField("contact_person", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Contact Phone</Label>
                  <Input value={formState.contact_phone} onChange={(e) => updateField("contact_phone", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Contact Email</Label>
                  <Input value={formState.contact_email} onChange={(e) => updateField("contact_email", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">General Email</Label>
                  <Input value={formState.email} onChange={(e) => updateField("email", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">General Phone</Label>
                  <Input value={formState.phone} onChange={(e) => updateField("phone", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Industry</Label>
                  <Input value={formState.industry} onChange={(e) => updateField("industry", e.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Business Info</h3>
                <p className="text-xs text-slate-500">Commercial, tax, and registration details.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Credit Limit</Label>
                  <Input value={formState.credit_limit} onChange={(e) => updateField("credit_limit", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Postal Code</Label>
                  <Input value={formState.postal_code} onChange={(e) => updateField("postal_code", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Fax Number</Label>
                  <Input value={formState.fax_number} onChange={(e) => updateField("fax_number", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Registration Number</Label>
                  <Input value={formState.registration_number} onChange={(e) => updateField("registration_number", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Registration Name</Label>
                  <Input value={formState.registration_name} onChange={(e) => updateField("registration_name", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">CK Number</Label>
                  <Input value={formState.ck_number} onChange={(e) => updateField("ck_number", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Tax Number</Label>
                  <Input value={formState.tax_number} onChange={(e) => updateField("tax_number", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">VAT Number</Label>
                  <Input value={formState.vat_number} onChange={(e) => updateField("vat_number", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Operating Hours</Label>
                  <Input value={formState.operating_hours} onChange={(e) => updateField("operating_hours", e.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Additional Notes</h3>
                <p className="text-xs text-slate-500">Operational notes and capacity details.</p>
              </div>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Capacity</Label>
                  <Input value={formState.capacity} onChange={(e) => updateField("capacity", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Notes</Label>
                  <Input value={formState.notes} onChange={(e) => updateField("notes", e.target.value)} />
                </div>
              </div>
            </section>

            <div className="sticky bottom-0 flex gap-3 border-t border-slate-200 bg-white pt-4">
              <Button onClick={handleSaveClient} disabled={isSaving}>
                {isSaving ? "Saving..." : editingClientId ? "Update Client" : "Save Client"}
              </Button>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
