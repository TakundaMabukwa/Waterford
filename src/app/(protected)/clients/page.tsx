"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Mail,
  MapPinned,
  Pencil,
  Phone,
  Plus,
  Search,
  User2,
} from "lucide-react";

import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { SecureButton } from "@/components/SecureButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FuelStopForm } from "@/components/ui/fuel-stop-modal";
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
};

type FuelStopRecord = {
  id: number;
  name?: string | null;
  name2?: string | null;
  geozone_name?: string | null;
  type?: string | null;
  address?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  coords?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  operating_hours?: string | null;
  capacity?: string | null;
  notes?: string | null;
  facilities?: string[] | null;
  fuel_price_per_liter?: number | null;
  geozone_coordinates?: unknown;
  location_coordinates?: unknown;
  coordinates?: string | null;
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
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [activeTab, setActiveTab] = useState("clients");
  const [search, setSearch] = useState("");

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isClientSheetOpen, setIsClientSheetOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [clientFormState, setClientFormState] = useState<ClientFormState>(defaultFormState);

  const [stops, setStops] = useState<FuelStopRecord[]>([]);
  const [isLoadingStops, setIsLoadingStops] = useState(true);
  const [isStopSheetOpen, setIsStopSheetOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<FuelStopRecord | null>(null);

  const fetchClients = async () => {
    setIsLoadingClients(true);
    try {
      const response = await fetch("/api/eps-client-list", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to load clients");
      setClients(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      console.error("Failed to load clients:", error);
      toast.error("Could not load clients right now");
      setClients([]);
    } finally {
      setIsLoadingClients(false);
    }
  };

  const fetchStops = async () => {
    setIsLoadingStops(true);
    try {
      const { data, error } = await supabase
        .from("fuel_stops")
        .select("id,name,name2,geozone_name,type,address,street,city,state,country,coords,contact_person,contact_phone,contact_email,operating_hours,capacity,notes,facilities,fuel_price_per_liter,geozone_coordinates,location_coordinates,coordinates")
        .order("name", { ascending: true });
      if (error) throw error;
      setStops(Array.isArray(data) ? (data as FuelStopRecord[]) : []);
    } catch (error) {
      console.error("Failed to load fuel stops:", error);
      toast.error("Could not load stops right now");
      setStops([]);
    } finally {
      setIsLoadingStops(false);
    }
  };

  useEffect(() => {
    void fetchClients();
    void fetchStops();
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

  const filteredStops = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return stops;
    return stops.filter((stop) =>
      [
        stop.name,
        stop.name2,
        stop.geozone_name,
        stop.address,
        stop.street,
        stop.city,
        stop.state,
        stop.country,
        stop.contact_person,
        stop.contact_phone,
        stop.contact_email,
        stop.type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [stops, search]);

  const activeClients = filteredClients.filter((client) => client.status !== "Inactive").length;
  const dormantClients = filteredClients.filter((client) => Boolean(client.dormant_flag)).length;
  const stopStations = filteredStops.filter((stop) => (stop.type || "").toLowerCase().includes("fuel")).length;
  const stopWithPrice = filteredStops.filter((stop) => Number(stop.fuel_price_per_liter || 0) > 0).length;
  const stopWithContacts = filteredStops.filter((stop) => Boolean(stop.contact_person || stop.contact_phone || stop.contact_email)).length;

  const updateClientField = (field: keyof ClientFormState, value: string) => {
    setClientFormState((prev) => ({ ...prev, [field]: value }));
  };

  const openCreateClient = () => {
    setEditingClientId(null);
    setClientFormState(defaultFormState);
    setIsClientSheetOpen(true);
  };

  const openEditClient = (client: ClientRecord) => {
    setEditingClientId(client.id);
    setClientFormState({
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
    setIsClientSheetOpen(true);
  };

  const closeClientForm = () => {
    setIsClientSheetOpen(false);
    setEditingClientId(null);
    setClientFormState(defaultFormState);
  };

  const handleSaveClient = async () => {
    if (!clientFormState.name.trim() && !clientFormState.client_id.trim()) {
      toast.error("Enter at least a client name or client ID");
      return;
    }

    setIsSavingClient(true);
    try {
      const response = await fetch("/api/eps-client-list", {
        method: editingClientId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingClientId ? { id: editingClientId, ...clientFormState } : clientFormState),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to save client");
      toast.success(editingClientId ? "Client updated successfully" : "Client added successfully");
      closeClientForm();
      await fetchClients();
    } catch (error) {
      console.error("Failed to save client:", error);
      toast.error("Could not save client right now");
    } finally {
      setIsSavingClient(false);
    }
  };

  const closeStopForm = () => {
    setEditingStop(null);
    setIsStopSheetOpen(false);
  };

  const currentTitle = activeTab === "clients" ? "Clients" : "Stops";
  const currentDescription = activeTab === "clients"
    ? "View, add, and update client records used in Load Plan."
    : "View, add, and update fuel stop and geozone records.";

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{currentTitle}</h1>
          <p className="text-slate-600">{currentDescription}</p>
        </div>
        {activeTab === "clients" ? (
          <SecureButton page="clients" action="create" onClick={openCreateClient}>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </SecureButton>
        ) : (
          <Button onClick={() => { setEditingStop(null); setIsStopSheetOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Stop
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="stops">Stops</TabsTrigger>
        </TabsList>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === "clients" ? "Search by client ID, name, contact, or address..." : "Search by stop name, geozone, contact, or address..."}
            className="pl-9"
          />
        </div>

        <TabsContent value="clients" className="space-y-6">
          <div className="grid w-full min-w-0 gap-4 md:grid-cols-3">
            <Card className="min-w-0"><CardContent className="pt-6"><div className="text-sm text-slate-500">Total Clients</div><div className="mt-2 text-3xl font-bold text-slate-900">{clients.length}</div></CardContent></Card>
            <Card className="min-w-0"><CardContent className="pt-6"><div className="text-sm text-slate-500">Active</div><div className="mt-2 text-3xl font-bold text-emerald-600">{activeClients}</div></CardContent></Card>
            <Card className="min-w-0"><CardContent className="pt-6"><div className="text-sm text-slate-500">Dormant</div><div className="mt-2 text-3xl font-bold text-amber-600">{dormantClients}</div></CardContent></Card>
          </div>

          <Card className="w-full min-w-0 max-w-full overflow-hidden">
            <CardHeader><CardTitle>Client List</CardTitle></CardHeader>
            <CardContent>
              <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200">
                <Table className="w-full table-fixed">
                  <TableHeader><TableRow className="bg-slate-50"><TableHead className="w-[14%]">Client ID</TableHead><TableHead className="w-[18%]">Name</TableHead><TableHead className="w-[14%]">Contact</TableHead><TableHead className="w-[19%]">Phone / Email</TableHead><TableHead className="w-[27%]">Address</TableHead><TableHead className="w-[8%] whitespace-nowrap text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {isLoadingClients ? (
                      <TableRow><TableCell colSpan={6} className="h-28 text-center text-slate-500">Loading clients...</TableCell></TableRow>
                    ) : filteredClients.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="h-28 text-center text-slate-500">No client rows found.</TableCell></TableRow>
                    ) : filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="align-top"><div className="whitespace-normal break-words leading-7 font-medium text-slate-900">{client.client_id || "-"}</div></TableCell>
                        <TableCell className="align-top"><div className="flex min-w-0 flex-col whitespace-normal break-words leading-7"><span className="font-medium text-slate-900">{client.name || "-"}</span>{client.industry ? <span className="text-xs text-slate-500">{client.industry}</span> : null}</div></TableCell>
                        <TableCell className="align-top"><div className="flex min-w-0 items-start gap-2 whitespace-normal break-words text-sm leading-7 text-slate-700"><User2 className="mt-0.5 h-4 w-4 text-slate-400" /><span>{client.contact_person || "-"}</span></div></TableCell>
                        <TableCell className="align-top"><div className="min-w-0 space-y-2 text-sm text-slate-700"><div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-slate-400" /><span className="whitespace-normal break-all leading-6">{client.contact_phone || client.phone || "-"}</span></div><div className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-slate-400" /><span className="whitespace-normal break-all leading-6">{client.contact_email || client.email || "-"}</span></div></div></TableCell>
                        <TableCell className="align-top"><div className="flex min-w-0 items-start gap-2 text-sm text-slate-700"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span className="whitespace-normal break-words leading-6">{[client.address, client.city, client.state, client.country].filter(Boolean).join(", ") || "-"}</span></div></TableCell>
                        <TableCell className="align-top whitespace-nowrap text-right"><SecureButton page="clients" action="edit" variant="outline" size="sm" className="inline-flex min-w-[84px] justify-center px-2" onClick={() => openEditClient(client)}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</SecureButton></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stops" className="space-y-6">
          <div className="grid w-full min-w-0 gap-4 md:grid-cols-3">
            <Card className="min-w-0"><CardContent className="pt-6"><div className="text-sm text-slate-500">Total Stops</div><div className="mt-2 text-3xl font-bold text-slate-900">{stops.length}</div></CardContent></Card>
            <Card className="min-w-0"><CardContent className="pt-6"><div className="text-sm text-slate-500">Fuel Stops</div><div className="mt-2 text-3xl font-bold text-emerald-600">{stopStations}</div></CardContent></Card>
            <Card className="min-w-0"><CardContent className="pt-6"><div className="text-sm text-slate-500">With Contact</div><div className="mt-2 text-3xl font-bold text-amber-600">{stopWithContacts}</div></CardContent></Card>
          </div>

          <Card className="w-full min-w-0 max-w-full overflow-hidden">
            <CardHeader><CardTitle>Stop List</CardTitle></CardHeader>
            <CardContent>
              <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200">
                <Table className="w-full table-fixed">
                  <TableHeader><TableRow className="bg-slate-50"><TableHead className="w-[18%]">Stop</TableHead><TableHead className="w-[18%]">Geozone</TableHead><TableHead className="w-[18%]">Contact</TableHead><TableHead className="w-[10%]">Fuel Price</TableHead><TableHead className="w-[28%]">Address</TableHead><TableHead className="w-[8%] whitespace-nowrap text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {isLoadingStops ? (
                      <TableRow><TableCell colSpan={6} className="h-28 text-center text-slate-500">Loading stops...</TableCell></TableRow>
                    ) : filteredStops.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="h-28 text-center text-slate-500">No stop rows found.</TableCell></TableRow>
                    ) : filteredStops.map((stop) => (
                      <TableRow key={stop.id}>
                        <TableCell className="align-top"><div className="flex min-w-0 items-start gap-2 text-sm text-slate-700"><MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><div className="min-w-0"><div className="break-words font-medium leading-6 text-slate-900">{stop.name || stop.name2 || "-"}</div><div className="text-xs text-slate-500">{stop.type || "fuel_station"}</div></div></div></TableCell>
                        <TableCell className="align-top"><div className="break-words text-sm leading-6 text-slate-700">{stop.geozone_name || "-"}</div></TableCell>
                        <TableCell className="align-top"><div className="space-y-2 text-sm text-slate-700"><div className="flex items-center gap-2"><User2 className="h-4 w-4 shrink-0 text-slate-400" /><span className="break-words">{stop.contact_person || "-"}</span></div><div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-slate-400" /><span className="break-all">{stop.contact_phone || "-"}</span></div><div className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-slate-400" /><span className="break-all">{stop.contact_email || "-"}</span></div></div></TableCell>
                        <TableCell className="align-top"><div className="text-sm font-medium text-slate-900">{stop.fuel_price_per_liter ? `R${Number(stop.fuel_price_per_liter).toFixed(2)}` : "-"}</div></TableCell>
                        <TableCell className="align-top"><div className="break-words text-sm leading-6 text-slate-700">{[stop.address || stop.street, stop.city, stop.state, stop.country].filter(Boolean).join(", ") || "-"}</div></TableCell>
                        <TableCell className="align-top whitespace-nowrap text-right"><Button variant="outline" size="sm" className="inline-flex min-w-[84px] justify-center px-2" onClick={() => { setEditingStop(stop); setIsStopSheetOpen(true); }}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 text-sm text-slate-500">Stops with fuel price: {stopWithPrice}</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={isClientSheetOpen} onOpenChange={(open) => { if (!open) { closeClientForm(); return; } setIsClientSheetOpen(true); }}>
        <SheetContent className="w-[920px] max-w-[96vw] overflow-y-auto px-0">
          <SheetHeader className="border-b border-slate-200 px-6 py-5"><SheetTitle>{editingClientId ? "Edit Client" : "Add Client"}</SheetTitle></SheetHeader>
          <div className="space-y-8 px-6 py-6">
            <section className="space-y-4"><div><h3 className="text-sm font-semibold text-slate-900">Basic Details</h3><p className="text-xs text-slate-500">Core client identity and location details.</p></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Client Name</Label><Input value={clientFormState.name} onChange={(e) => updateClientField("name", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Client ID</Label><Input value={clientFormState.client_id} onChange={(e) => updateClientField("client_id", e.target.value)} /></div><div className="space-y-2 md:col-span-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Address</Label><Input value={clientFormState.address} onChange={(e) => updateClientField("address", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">City</Label><Input value={clientFormState.city} onChange={(e) => updateClientField("city", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">State</Label><Input value={clientFormState.state} onChange={(e) => updateClientField("state", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Country</Label><Input value={clientFormState.country} onChange={(e) => updateClientField("country", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Status</Label><Input value={clientFormState.status} onChange={(e) => updateClientField("status", e.target.value)} /></div></div></section>
            <section className="space-y-4"><div><h3 className="text-sm font-semibold text-slate-900">Contacts</h3><p className="text-xs text-slate-500">Primary people and communication channels.</p></div><div className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Contact Person</Label><Input value={clientFormState.contact_person} onChange={(e) => updateClientField("contact_person", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Contact Phone</Label><Input value={clientFormState.contact_phone} onChange={(e) => updateClientField("contact_phone", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Contact Email</Label><Input value={clientFormState.contact_email} onChange={(e) => updateClientField("contact_email", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">General Email</Label><Input value={clientFormState.email} onChange={(e) => updateClientField("email", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">General Phone</Label><Input value={clientFormState.phone} onChange={(e) => updateClientField("phone", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Industry</Label><Input value={clientFormState.industry} onChange={(e) => updateClientField("industry", e.target.value)} /></div></div></section>
            <section className="space-y-4"><div><h3 className="text-sm font-semibold text-slate-900">Business Info</h3><p className="text-xs text-slate-500">Commercial, tax, and registration details.</p></div><div className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Credit Limit</Label><Input value={clientFormState.credit_limit} onChange={(e) => updateClientField("credit_limit", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Postal Code</Label><Input value={clientFormState.postal_code} onChange={(e) => updateClientField("postal_code", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Fax Number</Label><Input value={clientFormState.fax_number} onChange={(e) => updateClientField("fax_number", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Registration Number</Label><Input value={clientFormState.registration_number} onChange={(e) => updateClientField("registration_number", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Registration Name</Label><Input value={clientFormState.registration_name} onChange={(e) => updateClientField("registration_name", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">CK Number</Label><Input value={clientFormState.ck_number} onChange={(e) => updateClientField("ck_number", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Tax Number</Label><Input value={clientFormState.tax_number} onChange={(e) => updateClientField("tax_number", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">VAT Number</Label><Input value={clientFormState.vat_number} onChange={(e) => updateClientField("vat_number", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Operating Hours</Label><Input value={clientFormState.operating_hours} onChange={(e) => updateClientField("operating_hours", e.target.value)} /></div></div></section>
            <section className="space-y-4"><div><h3 className="text-sm font-semibold text-slate-900">Additional Notes</h3><p className="text-xs text-slate-500">Operational notes and capacity details.</p></div><div className="grid gap-4"><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Capacity</Label><Input value={clientFormState.capacity} onChange={(e) => updateClientField("capacity", e.target.value)} /></div><div className="space-y-2"><Label className="text-xs font-medium uppercase tracking-wide text-slate-600">Notes</Label><Input value={clientFormState.notes} onChange={(e) => updateClientField("notes", e.target.value)} /></div></div></section>
            <div className="sticky bottom-0 flex gap-3 border-t border-slate-200 bg-white pt-4"><Button onClick={handleSaveClient} disabled={isSavingClient}>{isSavingClient ? "Saving..." : editingClientId ? "Update Client" : "Save Client"}</Button><Button type="button" variant="outline" onClick={closeClientForm}>Cancel</Button></div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isStopSheetOpen} onOpenChange={(open) => { if (!open) { closeStopForm(); return; } setIsStopSheetOpen(true); }}>
        <SheetContent className="w-[min(1100px,96vw)] max-w-[96vw] overflow-y-auto p-0 sm:max-w-[96vw]">
          <FuelStopForm
            title={editingStop ? "Edit Fuel Stop" : "New Fuel Stop"}
            backLabel="Close"
            onCancel={closeStopForm}
            initialRecord={editingStop}
            onSaved={async () => {
              toast.success(editingStop ? "Stop updated successfully" : "Stop added successfully");
              closeStopForm();
              await fetchStops();
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
