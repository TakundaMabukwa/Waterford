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
import { Sheet, SheetContent } from "@/components/ui/sheet";
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
import { ClientFormDialog } from "@/components/ui/client-form-dialog";
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
  coordinates?: string | null;
  coords?: string | null;
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



export default function ClientsPage() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [activeTab, setActiveTab] = useState("clients");
  const [search, setSearch] = useState("");

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isClientSheetOpen, setIsClientSheetOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);

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

  const openCreateClient = () => {
    setEditingClientId(null);
    setIsClientSheetOpen(true);
  };

  const openEditClient = (client: ClientRecord) => {
    setEditingClientId(client.id);
    setIsClientSheetOpen(true);
  };

  const closeClientForm = () => {
    setIsClientSheetOpen(false);
    setEditingClientId(null);
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

      <ClientFormDialog
        open={isClientSheetOpen}
        onOpenChange={(open) => { if (!open) closeClientForm(); else setIsClientSheetOpen(true) }}
        onSaved={async () => { await fetchClients() }}
        initialRecord={editingClientId ? clients.find(c => c.id === editingClientId) : null}
      />

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
