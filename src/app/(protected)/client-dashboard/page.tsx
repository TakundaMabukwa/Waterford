"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, PackageSearch, Clock3, CircleCheckBig, AlertTriangle } from "lucide-react";

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

  useEffect(() => {
    const loadClientTrips = async () => {
      setLoading(true);

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;

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

      const clientLookupKey = currentProfile?.cost_code || currentProfile?.company || null;

      let clientIdentity: ClientIdentity | null = null;

      if (clientLookupKey) {
        const { data: clientByCode } = await supabase
          .from('eps_client_list')
          .select('id, name, client_id')
          .eq('client_id', clientLookupKey)
          .maybeSingle();

        clientIdentity = (clientByCode || null) as ClientIdentity | null;

        if (!clientIdentity) {
          const { data: clientByName } = await supabase
            .from('eps_client_list')
            .select('id, name, client_id')
            .eq('name', clientLookupKey)
            .maybeSingle();

          clientIdentity = (clientByName || null) as ClientIdentity | null;
        }
      }

      const clientKey = clientIdentity?.client_id || clientIdentity?.name || clientLookupKey;

      if (!clientKey) {
        setTrips([]);
        setLoading(false);
        return;
      }

      const tripColumns = 'id, trip_id, selected_client, status, start_date, end_date, origin, destination, route, driver, vehicle, notes';
      const [tripsByCodeResult, tripsByNameResult] = await Promise.all([
        clientIdentity?.client_id
          ? supabase.from('trips').select(tripColumns).eq('selected_client', clientIdentity.client_id).order('id', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        clientIdentity?.name && clientIdentity.name !== clientIdentity.client_id
          ? supabase.from('trips').select(tripColumns).eq('selected_client', clientIdentity.name).order('id', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      const mergedTrips = [
        ...((tripsByCodeResult.data || []) as ClientTrip[]),
        ...((tripsByNameResult.data || []) as ClientTrip[]),
      ].filter((trip, index, allTrips) => allTrips.findIndex((candidate) => candidate.id === trip.id) === index);

      const tripRows = mergedTrips.length > 0
        ? mergedTrips
        : clientKey
          ? (await supabase.from('trips').select(tripColumns).eq('selected_client', clientKey).order('id', { ascending: false })).data || []
          : [];

      setTrips(tripRows as ClientTrip[]);
      setProfile({
        ...currentProfile,
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
    () => trips.filter((trip) => String(trip.status || '').toLowerCase().includes('complete')),
    [trips],
  );

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Client dashboard</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Trips</h1>
          <p className="text-slate-600">A simple view of your trip progress, status, and history.</p>
        </div>
        <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-lg">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Account</div>
          <div className="text-sm font-semibold">{profile?.company || profile?.cost_code || 'Client account'}</div>
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

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-slate-700" />
            <CardTitle>Recent Trips</CardTitle>
          </div>
          <CardDescription>Latest trip records for this client only.</CardDescription>
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-slate-700" />
              <CardTitle>Active trips</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeTrips.length === 0 ? (
              <p className="text-sm text-slate-500">No active trips at the moment.</p>
            ) : (
              activeTrips.slice(0, 5).map((trip) => (
                <div key={trip.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{trip.trip_id}</div>
                      <div className="text-xs text-slate-500">{trip.origin || 'Origin not set'} → {trip.destination || 'Destination not set'}</div>
                    </div>
                    <Badge className={statusTone(trip.status)}>{trip.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CircleCheckBig className="h-5 w-5 text-slate-700" />
              <CardTitle>Completed trips</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {completedTrips.length === 0 ? (
              <p className="text-sm text-slate-500">No completed trips yet.</p>
            ) : (
              completedTrips.slice(0, 5).map((trip) => (
                <div key={trip.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="font-medium text-slate-900">{trip.trip_id}</div>
                  <div className="text-xs text-slate-500">{trip.origin || 'Origin not set'} → {trip.destination || 'Destination not set'}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
