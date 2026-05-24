"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PackageSearch, Clock3, CircleCheckBig, AlertTriangle, TrendingUp, MapPin, Truck, User } from "lucide-react";

type ClientTrip = {
  id: number;
  trip_id: string;
  selected_client: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  origin: string | null;
  destination: string | null;
  route: string | null;
  driver: string | null;
  vehicle: string | null;
  notes: string | null;
  clients_notes?: unknown;
};

type ClientProfile = {
  email: string;
  company: string | null;
  cost_code: string | null;
};

type ClientIdentity = {
  id: number;
  name: string;
  client_id: string | null;
};

type TripSourceRow = {
  client_id?: string | null;
  company?: string | null;
  cost_code?: string | null;
  clientId?: string | null;
  clientName?: string | null;
};

type TripJsonClientDetails = {
  client_id?: string | null;
  name?: string | null;
};

type ClientNote = {
  message: string;
  created_at: string | null;
  author: string | null;
};

const statusTone = (status: string) => {
  const normalized = (status || "").toLowerCase();
  if (normalized.includes("complete") || normalized.includes("done")) return "bg-emerald-100 text-emerald-800";
  if (normalized.includes("progress") || normalized.includes("active") || normalized.includes("dispatch")) return "bg-blue-100 text-blue-800";
  if (normalized.includes("cancel") || normalized.includes("fail") || normalized.includes("hold")) return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
};

export default function ClientDashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [trips, setTrips] = useState<ClientTrip[]>([]);
  const [noteInputs, setNoteInputs] = useState<Record<number, string>>({});
  const [savingNotes, setSavingNotes] = useState<Record<number, boolean>>({});
  const [noteErrors, setNoteErrors] = useState<Record<number, string>>({});

  const normalizeTrips = (tripRows: ClientTrip[]) =>
    tripRows.map((trip: any) => ({
      ...trip,
      start_date: trip.start_date ?? trip.startdate ?? null,
      end_date: trip.end_date ?? trip.enddate ?? null,
      selected_client: trip.selected_client ?? trip.selectedclient ?? null,
      client_details: trip.client_details ?? trip.clientdetails ?? null,
      clients_notes: trip.clients_notes ?? trip.clientsnotes ?? [],
    }));

  const parseClientNotes = (trip: ClientTrip): ClientNote[] => {
    const rawNotes = (trip as any).clients_notes ?? [];
    const parsedRaw = typeof rawNotes === 'string'
      ? (() => {
        try {
          return JSON.parse(rawNotes);
        } catch {
          return [];
        }
      })()
      : rawNotes;

    const asArray = Array.isArray(parsedRaw)
      ? parsedRaw
      : parsedRaw && typeof parsedRaw === 'object'
        ? [parsedRaw]
        : [];

    return asArray
      .map((note: any) => {
        const message = String(note?.message ?? note?.note ?? note?.text ?? '').trim();
        if (!message) return null;

        return {
          message,
          created_at: note?.created_at ?? note?.timestamp ?? null,
          author: note?.author ?? note?.email ?? note?.by ?? null,
        } as ClientNote;
      })
      .filter((note): note is ClientNote => Boolean(note));
  };

  const handleAddClientNote = async (trip: ClientTrip) => {
    const noteText = String(noteInputs[trip.id] || '').trim();
    if (!noteText) return;

    setSavingNotes((prev) => ({ ...prev, [trip.id]: true }));
    setNoteErrors((prev) => ({ ...prev, [trip.id]: '' }));

    const existingNotes = parseClientNotes(trip);
    const nextNotes = [
      ...existingNotes,
      {
        message: noteText,
        created_at: new Date().toISOString(),
        author: profile?.email || profile?.company || 'client',
      },
    ];

    const { error } = await supabase
      .from('trips')
      .update({ clients_notes: nextNotes, updated_at: new Date().toISOString() })
      .eq('id', trip.id);

    if (error) {
      setNoteErrors((prev) => ({ ...prev, [trip.id]: error.message || 'Failed to save note' }));
      setSavingNotes((prev) => ({ ...prev, [trip.id]: false }));
      return;
    }

    setTrips((prev) => prev.map((item) => (item.id === trip.id ? ({ ...item, clients_notes: nextNotes } as ClientTrip) : item)));
    setNoteInputs((prev) => ({ ...prev, [trip.id]: '' }));
    setSavingNotes((prev) => ({ ...prev, [trip.id]: false }));
  };

  const matchesTripKey = (trip: any, key: string) => {
    const selectedClient = trip.selected_client ?? trip.selectedclient ?? null;
    if (String(selectedClient || '').trim() === key) {
      return true;
    }

    const clientDetails = (trip.client_details ?? trip.clientdetails ?? null) as TripJsonClientDetails | string | null;
    const parsedClientDetails = typeof clientDetails === 'string' ? (() => {
      try {
        return JSON.parse(clientDetails) as TripJsonClientDetails;
      } catch {
        return null;
      }
    })() : clientDetails;

    return String(parsedClientDetails?.client_id || '').trim() === key || String(parsedClientDetails?.name || '').trim() === key;
  };

  const fetchTripsForKey = async (key: string) => {
    const tripColumns = '*';

    console.log('[ClientDashboard] Searching trips for key:', key);

    const { data, error } = await supabase
      .from('trips')
      .select(tripColumns)
      .order('id', { ascending: false });

    if (error) {
      console.error('[ClientDashboard] Trip query failed for key:', key, error);
      return [] as ClientTrip[];
    }

    return (data || []).filter((trip) => matchesTripKey(trip, key)) as ClientTrip[];
  };

  useEffect(() => {
    const loadClientTrips = async () => {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      const userMetadata = (authData.user?.user_metadata || {}) as TripSourceRow;

      if (!userId) {
        setTrips([]);
        setLoading(false);
        return;
      }

      const { data: userRow } = await supabase
        .from('users')
        .select('email, company, cost_code')
        .eq('id', userId)
        .single();

      const currentProfile = (userRow || null) as ClientProfile | null;
      setProfile(currentProfile);

      const clientIdLookupKeys = Array.from(new Set([
        currentProfile?.cost_code,
        userMetadata.clientId,
      ].filter((value): value is string => Boolean(value && value.trim()))));

      const clientNameLookupKeys = Array.from(new Set([
        currentProfile?.company,
        userMetadata.clientName,
      ].filter((value): value is string => Boolean(value && value.trim()))));

      let clientIdentity: ClientIdentity | null = null;

      for (const clientLookupKey of clientIdLookupKeys) {
        const { data: clientByCode } = await supabase
          .from('eps_client_list')
          .select('*')
          .eq('client_id', clientLookupKey)
          .maybeSingle();

        clientIdentity = (clientByCode || null) as ClientIdentity | null;

        if (clientIdentity) {
          break;
        }
      }

      if (!clientIdentity) {
        for (const clientLookupKey of clientNameLookupKeys) {
          const { data: clientByName } = await supabase
            .from('eps_client_list')
            .select('*')
            .eq('name', clientLookupKey)
            .maybeSingle();

          clientIdentity = (clientByName || null) as ClientIdentity | null;

          if (clientIdentity) {
            break;
          }
        }
      }

      const clientKeys = Array.from(new Set([
        clientIdentity?.client_id,
        clientIdentity?.name,
        ...clientIdLookupKeys,
        ...clientNameLookupKeys,
      ].filter((value): value is string => Boolean(value && value.trim()))));

      console.log('[ClientDashboard] Resolved client lookup keys:', {
        userId,
        profile: currentProfile,
        clientIdentity,
        clientKeys,
      });

      if (clientKeys.length === 0) {
        setTrips([]);
        setLoading(false);
        return;
      }

      const tripRows = (await Promise.all(clientKeys.map((key) => fetchTripsForKey(key)))).flat();
      const uniqueTripRows = tripRows.filter((trip, index, allTrips) => allTrips.findIndex((candidate) => candidate.id === trip.id) === index);

      console.log('[ClientDashboard] Trip fetch results:', {
        rawCount: tripRows.length,
        uniqueCount: uniqueTripRows.length,
        tripIds: uniqueTripRows.map((trip) => trip.trip_id),
      });

      setTrips(normalizeTrips(uniqueTripRows));
      setProfile({
        ...currentProfile,
        email: (currentProfile as any)?.email || (userRow as any)?.email || "",
        company: clientIdentity?.name || currentProfile?.company || null,
        cost_code: clientIdentity?.client_id || currentProfile?.cost_code || null,
      });
      setLoading(false);
    };

    loadClientTrips();
  }, [supabase]);

  const activeTrips = useMemo(
    () => trips.filter((trip) => !String(trip.status || '').toLowerCase().includes('complete')),
    [trips],
  );

  const completedTrips = useMemo(
    () => trips.filter((trip) => String(trip.status || '').toLowerCase().includes('delivered') || String(trip.status || '').toLowerCase().includes('completed') || String(trip.status || '').toLowerCase().includes('closed')),
    [trips],
  );

  const companyLabel = profile?.company || profile?.cost_code || 'Client account';

  const statusBreakdown = useMemo(() => {
    const counts = trips.reduce(
      (acc, trip) => {
        const status = String(trip.status || '').toLowerCase();
        if (status.includes('complete')) acc.completed += 1;
        else if (status.includes('cancel') || status.includes('hold') || status.includes('fail')) acc.problem += 1;
        else acc.active += 1;
        return acc;
      },
      { active: 0, completed: 0, problem: 0 },
    );

    return counts;
  }, [trips]);

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-xl md:px-8 md:py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(231,155,84,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_30%)]" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-200">Client dashboard</p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Trip visibility for {companyLabel}</h1>
            <p className="max-w-xl text-sm text-slate-200 md:text-base">
              View-only access to your company trips, current progress, and completed history.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-1 md:min-w-56">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Account</div>
              <div className="mt-1 font-semibold">{companyLabel}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Access</div>
              <div className="mt-1 font-semibold">Read only</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Total trips</CardDescription>
            <CardTitle className="text-3xl">{trips.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">All trips linked to this client.</CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Active trips</CardDescription>
            <CardTitle className="text-3xl">{activeTrips.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">Trips that are not complete yet.</CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl">{completedTrips.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">Trips marked finished or closed.</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Trip volume</CardDescription>
            <CardTitle className="text-3xl">{trips.length}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-slate-600">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            Company trip count
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl">{statusBreakdown.active}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-slate-600">
            <Truck className="h-4 w-4 text-blue-600" />
            In progress or pending
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl">{statusBreakdown.completed}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-slate-600">
            <CircleCheckBig className="h-4 w-4 text-emerald-600" />
            Closed trips
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Need attention</CardDescription>
            <CardTitle className="text-3xl">{statusBreakdown.problem}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-slate-600">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Delays or holds
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full justify-start rounded-2xl bg-slate-100 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="active">Active Trips</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-slate-700" />
                <CardTitle>Recent Trips</CardTitle>
              </div>
              <CardDescription>Latest trip records for this company only.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading trips...
                </div>
              ) : trips.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-600">
                  <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
                  No trips found for this client yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trip</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Vehicle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trips.map((trip) => (
                        <TableRow key={trip.id}>
                          <TableCell>
                            <div className="font-medium text-slate-900">{trip.trip_id}</div>
                            <div className="text-xs text-slate-500">{trip.origin || 'Origin not set'} → {trip.destination || 'Destination not set'}</div>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusTone(trip.status)}>{trip.status}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">{trip.route || 'No route assigned'}</TableCell>
                          <TableCell className="text-sm text-slate-600">{trip.driver || 'Unassigned'}</TableCell>
                          <TableCell className="text-sm text-slate-600">{trip.vehicle || 'Unassigned'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-slate-700" />
                <CardTitle>Active Trips</CardTitle>
              </div>
              <CardDescription>Current trips that are still progressing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeTrips.length === 0 ? (
                <p className="text-sm text-slate-500">No active trips at the moment.</p>
              ) : (
                activeTrips.map((trip) => (
                  <div key={trip.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{trip.trip_id}</div>
                        <div className="text-sm text-slate-600">{trip.origin || 'Origin not set'} → {trip.destination || 'Destination not set'}</div>
                        <div className="mt-1 text-xs text-slate-500">{trip.route || 'No route assigned'}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                        <div className="rounded-xl bg-white px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">Driver</div>
                          <div className="font-medium text-slate-900">{trip.driver || 'Unassigned'}</div>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">Vehicle</div>
                          <div className="font-medium text-slate-900">{trip.vehicle || 'Unassigned'}</div>
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">Status</div>
                          <Badge className={statusTone(trip.status)}>{trip.status}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">Client Notes</p>
                        <p className="text-xs text-slate-500">{parseClientNotes(trip).length} saved</p>
                      </div>

                      <div className="space-y-2">
                        {parseClientNotes(trip).length === 0 ? (
                          <p className="text-xs text-slate-500">No client notes yet.</p>
                        ) : (
                          parseClientNotes(trip).slice(-3).reverse().map((note, index) => (
                            <div key={`${trip.id}-note-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                              <p>{note.message}</p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                {note.author || 'Client'} {note.created_at ? `- ${new Date(note.created_at).toLocaleString()}` : ''}
                              </p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-3 space-y-2">
                        <Textarea
                          value={noteInputs[trip.id] || ''}
                          onChange={(event) => setNoteInputs((prev) => ({ ...prev, [trip.id]: event.target.value }))}
                          placeholder="Add a client note for this trip"
                          className="min-h-22.5"
                        />
                        {noteErrors[trip.id] ? <p className="text-xs text-red-600">{noteErrors[trip.id]}</p> : null}
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            onClick={() => handleAddClientNote(trip)}
                            disabled={savingNotes[trip.id] || !String(noteInputs[trip.id] || '').trim()}
                          >
                            {savingNotes[trip.id] ? 'Saving note...' : 'Send Note'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CircleCheckBig className="h-5 w-5 text-slate-700" />
                <CardTitle>Completed Trips</CardTitle>
              </div>
              <CardDescription>Finished trips and historical records.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {completedTrips.length === 0 ? (
                <p className="text-sm text-slate-500">No completed trips yet.</p>
              ) : (
                completedTrips.map((trip) => (
                  <div key={trip.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{trip.trip_id}</div>
                        <div className="text-sm text-slate-600">{trip.origin || 'Origin not set'} → {trip.destination || 'Destination not set'}</div>
                        <div className="mt-1 text-xs text-slate-500">{trip.route || 'No route assigned'}</div>
                      </div>
                      <Badge className={statusTone(trip.status)}>{trip.status}</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
