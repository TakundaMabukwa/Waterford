"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Vehicle {
  id: number;
  registration_number: string;
  engine_number: string | null;
  vin_number: string | null;
  make: string | null;
  model: string;
  sub_model: string | null;
  manufactured_year: string;
  vehicle_type: string;
  registration_date: string | null;
  license_expiry_date: string | null;
  purchase_price: number | null;
  retail_price: number | null;
  vehicle_priority: string | null;
  fuel_type: string | null;
  transmission_type: string | null;
  tank_capacity: number | null;
  register_number: string | null;
  take_on_kilometers: number;
  service_intervals: string;
  boarding_km_hours: number | null;
  expected_boarding_date: string | null;
  cost_centres: string | null;
  colour: string;
  created_at: string;
  updated_at: string;
  inspected: boolean | null;
  type: string | null;
  workshop_id: string | null;
}

function EditableField({
  label,
  name,
  value,
  type = "text",
  options,
  multiline = false,
  disabled = false,
  editing,
  editData,
  handleInputChange,
}: {
  label: string;
  name: keyof Vehicle;
  value: any;
  type?: string;
  options?: string[];
  multiline?: boolean;
  disabled?: boolean;
  editing: boolean;
  editData: Vehicle | null;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}) {
  const displayValue = value === null || value === undefined || value === "" ? "N/A" : value;

  return (
    <div>
      <p className="text-gray-500 text-sm">{label}</p>
      {editing ? (
        options ? (
          <select
            name={name}
            value={editData?.[name]?.toString() ?? ""}
            onChange={handleInputChange}
            className="border rounded px-2 py-1 w-full"
            disabled={disabled}
          >
            <option value="">Select</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : multiline ? (
          <textarea
            name={name}
            value={editData?.[name]?.toString() ?? ""}
            onChange={handleInputChange}
            className="border rounded px-2 py-1 w-full"
            disabled={disabled}
            rows={4}
          />
        ) : (
          <input
            name={name}
            type={type}
            value={editData?.[name]?.toString() ?? ""}
            onChange={handleInputChange}
            className="border rounded px-2 py-1 w-full"
            disabled={disabled}
          />
        )
      ) : (
        <p className="font-semibold">{displayValue}</p>
      )}
    </div>
  );
}

export default function VehicleDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Vehicle | null>(null);

  const fetchVehicle = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vehiclesc")
      .select("*")
      .eq("id", Number(params.id))
      .single();

    if (error) {
      console.error(error);
      toast.error("Error loading vehicle details");
    } else {
      setVehicle(data as Vehicle);
    }
    setLoading(false);
  }, [params.id, supabase]);

  useEffect(() => {
    if (params?.id) fetchVehicle();
  }, [params.id, fetchVehicle]);

  const handleDelete = async () => {
    if (!vehicle) return;
    setDeleting(true);

    const { error } = await supabase
      .from("vehiclesc")
      .delete()
      .eq("id", vehicle.id);

    setDeleting(false);

    if (error) {
      console.error("Error deleting vehicle:", error);
      toast.error("Failed to delete vehicle");
    } else {
      toast.success("Vehicle archived successfully");
      router.push("/vehicles");
    }
  };

  const handleUpdate = async () => {
    if (!editData) return;
    
    const { id, created_at, updated_at, ...updateData } = editData;
    
    const { error } = await supabase
      .from("vehiclesc")
      .update(updateData)
      .eq("id", id);
    
    if (error) {
      console.error("Error updating vehicle:", error);
      toast.error("Failed to update vehicle details");
      return;
    }
    
    setVehicle(editData);
    toast.success("Vehicle details updated");
    setEditing(false);
    fetchVehicle();
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    if (!editData) return;
    const { name, value } = e.target;
    setEditData((prev) => {
      if (!prev) return prev;
      return { ...prev, [name]: value };
    });
  };

  const startEditing = () => {
    if (!vehicle) return;
    setEditData({ ...vehicle });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    if (vehicle) {
      setEditData({ ...vehicle });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="w-96 h-96 rounded-xl" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center">
        <p className="text-lg font-semibold text-gray-600">
          Vehicle not found or has been archived.
        </p>
        <Button onClick={() => router.push("/vehicles")} className="mt-4">
          Back to Vehicles
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-gray-50 p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <h1 className="text-3xl font-bold">
            {vehicle.make} {vehicle.model}
          </h1>
          <div className="ml-auto">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={deleting}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? "Deleting..." : "Delete Vehicle"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will <strong>archive</strong> the vehicle. It
                    won't appear in lists anymore but will remain in the
                    database for record keeping. You can restore it later if
                    needed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deleting ? "Deleting..." : "Confirm"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div>
            {editing ? (
              <>
                <Button onClick={handleUpdate} className="ml-2">
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={cancelEditing}
                  className="ml-2"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={startEditing} className="ml-2">
                Edit Vehicle
              </Button>
            )}
          </div>
        </div>

        <Card className="p-6 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">
              Vehicle Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <motion.div
              className="flex flex-col md:flex-row gap-6"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="w-full md:w-1/3 flex items-center justify-center bg-gray-200 rounded-xl h-64">
                <span className="text-gray-500">Vehicle Image</span>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-4">
                <EditableField
                  label="Registration Number"
                  name="registration_number"
                  value={vehicle.registration_number}
                  editing={editing}
                  editData={editData}
                  handleInputChange={handleInputChange}
                />
                <EditableField
                  label="VIN"
                  name="vin_number"
                  value={vehicle.vin_number ?? "N/A"}
                  editing={editing}
                  editData={editData}
                  handleInputChange={handleInputChange}
                />
                <EditableField
                  label="Engine Number"
                  name="engine_number"
                  value={vehicle.engine_number ?? "N/A"}
                  editing={editing}
                  editData={editData}
                  handleInputChange={handleInputChange}
                />
                <EditableField
                  label="Colour"
                  name="colour"
                  value={vehicle.colour}
                  editing={editing}
                  editData={editData}
                  handleInputChange={handleInputChange}
                />
              </div>
            </motion.div>

            <Separator />

            <motion.div
              className="grid grid-cols-2 md:grid-cols-3 gap-4"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <EditableField
                label="Manufactured Year"
                name="manufactured_year"
                value={vehicle.manufactured_year}
                editing={editing}
                editData={editData}
                handleInputChange={handleInputChange}
              />
              <EditableField
                label="Vehicle Type"
                name="vehicle_type"
                value={vehicle.vehicle_type}
                editing={editing}
                editData={editData}
                handleInputChange={handleInputChange}
              />
              <EditableField
                label="Fuel Type"
                name="fuel_type"
                value={vehicle.fuel_type}
                editing={editing}
                editData={editData}
                handleInputChange={handleInputChange}
              />
              <EditableField
                label="Transmission"
                name="transmission_type"
                value={vehicle.transmission_type}
                editing={editing}
                editData={editData}
                handleInputChange={handleInputChange}
              />
              <EditableField
                label="Service Intervals"
                name="service_intervals"
                value={vehicle.service_intervals}
                editing={editing}
                editData={editData}
                handleInputChange={handleInputChange}
              />
              <EditableField
                label="Priority"
                name="vehicle_priority"
                value={<Badge>{vehicle.vehicle_priority}</Badge>}
                editing={editing}
                editData={editData}
                handleInputChange={handleInputChange}
              />
              <EditableField
                label="Purchase Price"
                name="purchase_price"
                value={`R ${vehicle.purchase_price ?? "N/A"}`}
                type="number"
                editing={editing}
                editData={editData}
                handleInputChange={handleInputChange}
              />
              <EditableField
                label="Retail Price"
                name="retail_price"
                value={`R ${vehicle.retail_price ?? "N/A"}`}
                type="number"
                editing={editing}
                editData={editData}
                handleInputChange={handleInputChange}
              />
              <EditableField
                label="Tank Capacity"
                name="tank_capacity"
                value={`${vehicle.tank_capacity ?? "N/A"} L`}
                type="number"
                editing={editing}
                editData={editData}
                handleInputChange={handleInputChange}
              />
              <EditableField
                label="Take On KM"
                name="take_on_kilometers"
                value={`${vehicle.take_on_kilometers}`}
                type="number"
                editing={editing}
                editData={editData}
                handleInputChange={handleInputChange}
              />
              <EditableField
                label="Boarding Hours"
                name="boarding_km_hours"
                value={vehicle.boarding_km_hours ?? "N/A"}
                type="number"
                editing={editing}
                editData={editData}
                handleInputChange={handleInputChange}
              />
              <EditableField
                label="Cost Centres"
                name="cost_centres"
                value={vehicle.cost_centres ?? "N/A"}
                editing={editing}
                editData={editData}
                handleInputChange={handleInputChange}
              />
            </motion.div>

            <Separator />

            <motion.div
              className="grid grid-cols-2 md:grid-cols-3 gap-4"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <EditableField
                label="Registration Date"
                name="registration_date"
                value={vehicle.registration_date ?? "N/A"}
                type="date"
                editing={editing}
                editData={editData}
                handleInputChange={handleInputChange}
              />
              <EditableField
                label="License Expiry"
                name="license_expiry_date"
                value={vehicle.license_expiry_date ?? "N/A"}
                type="date"
                editing={editing}
                editData={editData}
                handleInputChange={handleInputChange}
              />
              <EditableField
                label="Expected Boarding Date"
                name="expected_boarding_date"
                value={vehicle.expected_boarding_date ?? "N/A"}
                type="date"
                editing={editing}
                editData={editData}
                handleInputChange={handleInputChange}
              />
            </motion.div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
