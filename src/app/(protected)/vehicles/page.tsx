"use client";

import { Button } from "@/components/ui/button";
import { SecureButton } from "@/components/SecureButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Truck, Car, FileText, TruckElectricIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { initialVehiclesState } from "@/context/vehicles-context/context";

const vehicleFormSchema = z.object({
  id: z.number().int().optional(),
  registration_number: z.string().min(1, "Registration number is required"),
  horse_reg_no: z.string().optional(),
  engine_number: z.string().min(1, "Engine number is required"),
  vin_number: z.string().min(1, "VIN number is required"),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  sub_model: z.string().optional(),
  manufactured_year: z.string().min(1, "Manufactured year is required"),
  vehicle_type: z.enum(
    ["vehicle", "trailer", "commercial", "tanker", "truck", "specialized"],
    { required_error: "Vehicle type is required" }
  ),
  registration_date: z.string().min(1, "Registration date is required"),
  license_expiry_date: z.string().min(1, "License expiry date is required"),
  purchase_price: z.string().min(1, "Purchase price is required"),
  retail_price: z.string().min(1, "Retail price is required"),
  vehicle_priority: z.enum(["high", "medium", "low"], {
    required_error: "Vehicle priority is required",
  }),
  fuel_type: z.enum(["petrol", "diesel", "electric", "hybrid", "lpg"], {
    required_error: "Fuel type is required",
  }),
  transmission_type: z.enum(["manual", "automatic", "cvt"], {
    required_error: "Transmission type is required",
  }),
  tank_capacity: z.string().optional(),
  register_number: z.string().optional(),
  take_on_kilometers: z.string().min(1, "Take on kilometers is required"),
  service_intervals: z.string().min(1, "Service intervals is required"),
  boarding_km_hours: z.string().optional(),
  expected_boarding_date: z.string().optional(),
  cost_centres: z.string().optional(),
  colour: z.string().min(1, "Colour is required"),
  monthly_premium: z.string().optional(),
  hourly_rate: z.string().optional(),
  created_by: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  tech_id: z.number().int().optional(),
  driver_id: z.number().int().optional(),
  zim_permit_expiry_date: z.string().optional(),
  zam_permit_expiry_date: z.string().optional(),
  malawi_permit_expiry_date: z.string().optional(),
});

type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

interface Technician {
  id: number;
  name: string;
  phone: string;
  email: string;
}

interface Driver {
  id: number;
  first_name: string;
  surname: string;
  cell_number: string;
  email_address?: string | null;
}

interface CostCenter {
  id: number;
  company: string;
  cost_code: string;
}

const formatPermitDate = (value?: string | null) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

const daysUntil = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  parsed.setHours(0, 0, 0, 0)
  return Math.ceil((parsed.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

const getPermitTone = (days: number | null) => {
  if (days == null) return 'bg-slate-100 text-slate-500 border-slate-200'
  if (days < 0) return 'bg-rose-100 text-rose-700 border-rose-200'
  if (days <= 30) return 'bg-amber-100 text-amber-700 border-amber-200'
  if (days <= 90) return 'bg-orange-100 text-orange-700 border-orange-200'
  return 'bg-emerald-100 text-emerald-700 border-emerald-200'
}

const getVehicleDefaultValues = (): VehicleFormValues => ({
  registration_number: "",
  horse_reg_no: "",
  engine_number: "",
  vin_number: "",
  make: "",
  model: "",
  sub_model: "",
  manufactured_year: "",
  vehicle_type: "vehicle",
  registration_date: new Date().toISOString().split('T')[0],
  license_expiry_date: new Date().toISOString().split('T')[0],
  purchase_price: "",
  retail_price: "",
  vehicle_priority: "medium",
  fuel_type: "petrol",
  transmission_type: "manual",
  tank_capacity: "",
  register_number: "",
  take_on_kilometers: "",
  service_intervals: "",
  boarding_km_hours: "",
  expected_boarding_date: new Date().toISOString().split('T')[0],
  cost_centres: "",
  colour: "",
  monthly_premium: "",
  hourly_rate: "",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  zim_permit_expiry_date: "",
  zam_permit_expiry_date: "",
  malawi_permit_expiry_date: "",
})

const normalizeVehicleFormValues = (vehicle: VehicleFormValues): VehicleFormValues => ({
  ...getVehicleDefaultValues(),
  ...vehicle,
  registration_date: vehicle.registration_date?.split('T')[0] || '',
  license_expiry_date: vehicle.license_expiry_date?.split('T')[0] || '',
  expected_boarding_date: vehicle.expected_boarding_date?.split('T')[0] || '',
  zim_permit_expiry_date: vehicle.zim_permit_expiry_date?.split('T')[0] || '',
  zam_permit_expiry_date: vehicle.zam_permit_expiry_date?.split('T')[0] || '',
  malawi_permit_expiry_date: vehicle.malawi_permit_expiry_date?.split('T')[0] || '',
  purchase_price: vehicle.purchase_price?.toString() || '',
  retail_price: vehicle.retail_price?.toString() || '',
  tank_capacity: vehicle.tank_capacity?.toString() || '',
  take_on_kilometers: vehicle.take_on_kilometers?.toString() || '',
  service_intervals: vehicle.service_intervals?.toString() || '',
  boarding_km_hours: vehicle.boarding_km_hours?.toString() || '',
  monthly_premium: vehicle.monthly_premium?.toString() || '',
  hourly_rate: vehicle.hourly_rate?.toString() || '',
  cost_centres: vehicle.cost_centres?.toString() || '',
  register_number: vehicle.register_number?.toString() || '',
  sub_model: vehicle.sub_model?.toString() || '',
  horse_reg_no: vehicle.horse_reg_no?.toString() || '',
})

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<VehicleFormValues[]>([]);
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    null
  );
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);

  useEffect(() => {
    const getDrivers = async () => {
      const { data, error } = await supabase.from("drivers").select("*");
      if (error) {
        console.error("Error fetching drivers:", error);
        setDrivers([]);
        return;
      }
      setDrivers(data as []);
    };
    
    const getCostCenters = async () => {
      const { data, error } = await supabase
        .from("level_3_cost_centers")
        .select("id, company, cost_code")
        .order("company");
      if (error) {
        console.error("Error fetching cost centers:", error);
        setCostCenters([]);
        return;
      }
      setCostCenters(data as CostCenter[]);
    };
    
    getDrivers();
    getCostCenters();
  }, []);

  useEffect(() => {
    const filtered = drivers.filter((driver) =>
      `${driver.first_name} ${driver.surname}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
    setFilteredDrivers(filtered);
  }, [searchTerm, drivers]);


  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [filteredTechs, setFilteredTechs] = useState<Technician[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleFormValues | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [equipmentData, setEquipmentData] = useState<any[]>([]);
  const [isEquipmentSheetOpen, setIsEquipmentSheetOpen] = useState(false);
  const [equipmentVehicleReg, setEquipmentVehicleReg] = useState("");
  
  

  useEffect(() => {
    const getTechnician = async () => {
      // Fetch technicians
      const { data: user, error: userError } = await supabase.auth.getUser();
      const currentUser = user.user?.id;

      if (!currentUser) {
        setTechnicians([]);
        return;
      }
      const { data: techniciansData, error: techError } = await supabase
        .from("technicians")
        .select("*")
        // .eq("type", "internal");

      setTechnicians(techniciansData as []);

      if (techError) {
        console.error("Error fetching technicians:", techError);
        setTechnicians([]);
        return;
      }
    };
    getTechnician();
  }, []);

  useEffect(() => {
    const filtered = technicians.filter((tech) =>
      tech.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTechs(filtered as []);
  }, [searchTerm, technicians]);

  const handleUploadFile = () => {
    if (!selectedFile) return;
    // TODO: Implement upload logic here
    toast.info(`Uploading: ${selectedFile.name}`);
  };

  const getNearestPermitDays = (vehicle: VehicleFormValues) => {
    const permitDays = [
      daysUntil(vehicle.zim_permit_expiry_date),
      daysUntil(vehicle.zam_permit_expiry_date),
      daysUntil(vehicle.malawi_permit_expiry_date),
    ].filter((value): value is number => value != null)

    if (!permitDays.length) return null
    return Math.min(...permitDays)
  }

  // Filter + sort vehicles based on nearest permit expiry first
  const filteredVehicles = useMemo(() => {
    const searchLower = search.toLowerCase()

    return [...vehicles]
      .filter((vehicle) =>
        (vehicle.make || '').toLowerCase().includes(searchLower) ||
        (vehicle.model || '').toLowerCase().includes(searchLower) ||
        (vehicle.registration_number || '').toLowerCase().includes(searchLower) ||
        (vehicle.horse_reg_no || '').toLowerCase().includes(searchLower) ||
        (vehicle.vehicle_type || '').toLowerCase().includes(searchLower)
      )
      .sort((a, b) => {
        const aDays = getNearestPermitDays(a)
        const bDays = getNearestPermitDays(b)

        if (aDays == null && bDays == null) return (a.registration_number || '').localeCompare(b.registration_number || '')
        if (aDays == null) return 1
        if (bDays == null) return -1
        if (aDays !== bDays) return aDays - bDays
        return (a.registration_number || '').localeCompare(b.registration_number || '')
      })
  }, [search, vehicles])

  // Pagination state & logic (50 per page)
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / PAGE_SIZE));
  // Ensure currentPage stays within bounds when filteredVehicles changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const paginatedVehicles = filteredVehicles.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const expiringVehicles = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        vehicle,
        nearestPermitDays: getNearestPermitDays(vehicle),
      })),
    [vehicles]
  )

  const expiringIn30 = expiringVehicles.filter((item) => item.nearestPermitDays != null && item.nearestPermitDays >= 0 && item.nearestPermitDays <= 30).length
  const expiringIn90 = expiringVehicles.filter((item) => item.nearestPermitDays != null && item.nearestPermitDays >= 0 && item.nearestPermitDays <= 90).length
  const expiringIn180 = expiringVehicles.filter((item) => item.nearestPermitDays != null && item.nearestPermitDays >= 0 && item.nearestPermitDays <= 180).length

  // Row background color by type
  const getRowBg = (type: string) => {
    switch (type) {
      case "vehicle":
        return "bg-blue-50";
      case "trailer":
        return "bg-purple-50";
      case "truck":
        return "bg-yellow-50";
      case "commercial":
        return "bg-green-50";
      case "tanker":
        return "bg-orange-50";
      case "specialized":
        return "bg-pink-50";
      default:
        return "";
    }
  };

  const fetchVehicles = async () => {
    const { data: vehicles, error } = await supabase
      .from("vehiclesc")
      .select("*")
      // Keep legacy/internal records regardless of case
      .or("type.is.null,type.eq.internal,type.eq.Internal")
      // Exclude SOLD rows but retain rows where department is null/blank
      .or("department_name.is.null,department_name.eq.,department_name.neq.SOLD");
    if (error) {
      console.error("the error is", error.name, error.message);
      toast.error(`Failed to load vehicles: ${error.message}`);
    } else {
      // @ts-expect-error
      setVehicles(vehicles || []);
    }
  };
  useEffect(() => {
    const vehiclesc = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehiclesc" },
        (payload) => {
          console.log("Change received!", payload);
        }
      )
      .subscribe();
    fetchVehicles();

    return () => {
      vehiclesc.unsubscribe();
    };
  }, []);

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: getVehicleDefaultValues(),
  });

  const openAddVehicleForm = () => {
    setIsEditing(false)
    setEditingVehicleId(null)
    form.reset(getVehicleDefaultValues())
    setIsAddingVehicle(true)
  }

  const openEditVehicleForm = (vehicle: VehicleFormValues) => {
    setIsEditing(true)
    setEditingVehicleId(Number(vehicle.id))
    form.reset(normalizeVehicleFormValues(vehicle))
    setIsAddingVehicle(true)
  }

  const closeVehicleForm = () => {
    setIsAddingVehicle(false)
    setIsEditing(false)
    setEditingVehicleId(null)
    form.reset(getVehicleDefaultValues())
  }

  const onSubmit = async (data: VehicleFormValues) => {
    console.log('onSubmit called with data:', data);
    console.log('Form errors:', form.formState.errors);
    try {
      if (isEditing && editingVehicleId) {
        await handleUpdateVehicle(data);
      } else {
        await handleAddVehicle(data);
      }
      fetchVehicles();
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error('Form submission failed: ' + (error as Error).message);
    }
  };

  const handleAddVehicle = async (data: VehicleFormValues) => {
    console.log('Form data received:', data);
    const { id, ...dataWithoutId } = data;
    const vehicleData = {
      ...dataWithoutId,
      monthly_premium: data.monthly_premium ? parseFloat(data.monthly_premium.replace(/[^0-9.]/g, '')) : null,
      hourly_rate: data.hourly_rate ? parseFloat(data.hourly_rate.replace(/[^0-9.]/g, '')) : null
    };
    console.log('Vehicle data to insert:', vehicleData);
    const { data: vehicle, error } = await supabase
      .from("vehiclesc")
      // @ts-expect-error
      .insert(vehicleData);
    if (error) {
      console.error(error.message);
      toast.error("Failed to add vehicle: " + error.message);
      throw new Error(error.message);
    } else {
      console.log(vehicle);
      toast.success("Vehicle added successfully");
      fetchVehicles();
      closeVehicleForm();
      router.refresh();
    }
  };

  const handleUpdateVehicle = async (data: VehicleFormValues) => {
    if (!editingVehicleId) return;
    
    const vehicleData = {
      ...data,
      monthly_premium: data.monthly_premium ? parseFloat(data.monthly_premium.replace(/[^0-9.]/g, '')) : null,
      hourly_rate: data.hourly_rate ? parseFloat(data.hourly_rate.replace(/[^0-9.]/g, '')) : null
    };
    
    const { error } = await supabase
      .from("vehiclesc")
      .update(vehicleData)
      .eq("id", editingVehicleId);
    
    if (error) {
      console.error(error.message);
      toast.error("Failed to update vehicle: " + error.message);
      throw new Error(error.message);
    } else {
      toast.success("Vehicle updated successfully");
      fetchVehicles();
      closeVehicleForm();
      router.refresh();
    }
  };

  const getVehicleTypeIcon = (type: string) => {
    return type === "vehicle" ? (
      <Car className="w-4 h-4" />
    ) : (
      <Truck className="w-4 h-4" />
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: "bg-red-100 text-red-700 border-red-200",
      medium: "bg-amber-100 text-amber-700 border-amber-200",
      low: "bg-green-100 text-green-700 border-green-200",
    };
    return (
      <Badge className={`${colors[priority as keyof typeof colors]} text-xs px-2 py-0.5 font-medium border`}>
        {priority?.toUpperCase() || 'N/A'}
      </Badge>
    );
  };

  const getAssignedDriverName = (driverId?: number | null) => {
    const driver = drivers.find((item) => item.id === driverId)
    return driver ? `${driver.first_name} ${driver.surname}`.trim() : 'Unassigned'
  }

  async function handleAssignDriver(vehicleId: number, driverId: number) {
    const { data, error } = await supabase
      .from("vehiclesc")
      .update({ driver_id: driverId })
      .eq("id", vehicleId)
      .select();

    if (error) {
      console.error("Issue in assigning driver:", error.message);
      alert("Failed to assign driver: " + error.message);
      return;
    }
    console.log("Driver assigned successfully:", data);
    fetchVehicles();
    // Optionally refresh or update state if needed
  }

  async function handleAssign(vehicleId: number, techId: number) {
    const { data: datav, error: errorv } = await supabase
      .from("vehiclesc")
      .update({ tech_id: techId })
      .eq("id", vehicleId)
      .select();

    if (errorv) {
      console.log("Issue in assigning: " + errorv.message);
      alert("Failed to assign technician: " + errorv.message);
      return;
    }
    console.log("Technician assigned successfully:", datav);
  }

  const fetchEquipmentData = async (registration: string) => {
    console.log('Searching for equipment with registration:', registration);
    
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .ilike('reg', registration.trim());
    
    if (error) {
      console.error('Error fetching equipment:', error);
      toast.error('Failed to fetch equipment data');
      return;
    }
    
    console.log('Equipment data found:', data);
    setEquipmentData(data || []);
  };

  const { columns } = initialVehiclesState;
  // console.log("The vehicles are", columns)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vehicles</h1>
          <p className="text-gray-600 mt-1">
            Manage your vehicle and trailer fleet
          </p>
        </div>
        <SecureButton
          page="vehicles"
          action="create"
          onClick={openAddVehicleForm}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Vehicle
        </SecureButton>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Fleet</p>
                <p className="text-2xl font-bold text-gray-900">{vehicles.length}</p>
                <p className="mt-1 text-xs text-gray-500">All active vehicles and trailers</p>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-sm font-semibold">🚗</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Permits Due In 1 Month</p>
                <p className="text-2xl font-bold text-amber-600">{expiringIn30}</p>
                <p className="mt-1 text-xs text-gray-500">0 to 30 days</p>
              </div>
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Permits Due In 3 Months</p>
                <p className="text-2xl font-bold text-orange-600">{expiringIn90}</p>
                <p className="mt-1 text-xs text-gray-500">0 to 90 days</p>
              </div>
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <Car className="w-4 h-4 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Permits Due In 6 Months</p>
                <p className="text-2xl font-bold text-red-600">{expiringIn180}</p>
                <p className="mt-1 text-xs text-gray-500">0 to 180 days</p>
              </div>
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-red-600 text-sm font-semibold">⚠</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Add Vehicle Form */}
      {isAddingVehicle && (
        <Card>
          <CardHeader>
            <CardTitle>{isEditing ? 'Edit Vehicle' : 'Add New Vehicle'}</CardTitle>
          </CardHeader>
          {/* <CardContent>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6 flex flex-col items-center bg-gray-50">
              <div className="flex flex-col items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <p className="text-lg font-semibold text-gray-700">Upload Vehicles</p>
                <p className="text-sm text-gray-500 mb-2">Upload new vehicles using a CSV or spreadsheet file</p>
              </div>
              <input
                id="vehicle-upload"
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                className="border-2 p-2 rounded-4xl"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              />
              {selectedFile && (
                <span className="mt-2 text-sm text-gray-600">Selected: {selectedFile.name}</span>
              )}
              <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white" type="button" disabled={!selectedFile} onClick={handleUploadFile}>
                Upload File
              </Button>
            </div>
          </CardContent> */}

          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Vehicle Type Selection */}
                  <FormField
                    control={form.control}
                    name="vehicle_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle Type *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select vehicle type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="vehicle">
                              <div className="flex items-center gap-2">
                                <Car className="w-4 h-4" />
                                Vehicle
                              </div>
                            </SelectItem>
                            <SelectItem value="commercial">
                              <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4" />
                                Commercial
                              </div>
                            </SelectItem>
                            <SelectItem value="tanker">
                              <div className="flex items-center gap-2">
                                <TruckElectricIcon className="w-4 h-4" />
                                Truck
                              </div>
                            </SelectItem>
                            <SelectItem value="truck">
                              <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4" />
                                Tanker
                              </div>
                            </SelectItem>
                            <SelectItem value="specialized">
                              <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4" />
                                Specialized
                              </div>
                            </SelectItem>
                            <SelectItem value="trailer">
                              <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4" />
                                Trailer
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="registration_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="ABC 123 GP" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="horse_reg_no"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horse Reg No</FormLabel>
                        <FormControl>
                          <Input placeholder="Horse registration reference" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="make"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Make *</FormLabel>
                        <FormControl>
                          <Input placeholder="Toyota" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model *</FormLabel>
                        <FormControl>
                          <Input placeholder="Hilux" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="engine_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Engine Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="ENG123456" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vin_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VIN Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="VIN123456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sub_model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sub Model</FormLabel>
                        <FormControl>
                          <Input placeholder="Double Cab" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="manufactured_year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manufactured Year *</FormLabel>
                        <FormControl>
                          <Input placeholder="2023" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="registration_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="license_expiry_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License Expiry Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="zim_permit_expiry_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIM Permit Expiry</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="zam_permit_expiry_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZAM Permit Expiry</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="malawi_permit_expiry_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Malawi Permit Expiry</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fuel_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fuel Type *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select fuel type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="petrol">Petrol</SelectItem>
                            <SelectItem value="diesel">Diesel</SelectItem>
                            <SelectItem value="electric">Electric</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                            <SelectItem value="lpg">LPG</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transmission_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transmission *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select transmission" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="automatic">Automatic</SelectItem>
                            <SelectItem value="cvt">CVT</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="boarding_km_hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Boarding KM/Hours</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 1000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expected_boarding_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Boarding Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cost_centres"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost Centres</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select cost centre" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {costCenters.map((center) => (
                              <SelectItem key={center.id} value={center.company}>
                                {center.company}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="register_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Register Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., ZN123456" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tank_capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tank Capacity (L)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 80" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vehicle_priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="colour"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Colour *</FormLabel>
                        <FormControl>
                          <Input placeholder="White" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purchase_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price *</FormLabel>
                        <FormControl>
                          <Input placeholder="R 500,000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retail_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Retail Price *</FormLabel>
                        <FormControl>
                          <Input placeholder="R 550,000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="take_on_kilometers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Take On Kilometers *</FormLabel>
                        <FormControl>
                          <Input placeholder="50,000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="service_intervals"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Intervals *</FormLabel>
                        <FormControl>
                          <Input placeholder="15,000 km" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="monthly_premium"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Premium</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="R 5,000" 
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              const value = e.target.value.replace(/[^0-9.]/g, '');
                              if (value) {
                                const monthly = parseFloat(value);
                                const hourly = (monthly / 30 / 8).toFixed(2);
                                form.setValue('hourly_rate', hourly);
                              } else {
                                form.setValue('hourly_rate', '');
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hourly_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hourly Rate (Auto-calculated)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="R 20.83" 
                            {...field}
                            readOnly
                            className="bg-gray-50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-4">
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {isEditing ? 'Update Vehicle' : 'Save Vehicle'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeVehicleForm}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Vehicle List */}
      {vehicles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fleet Overview</CardTitle>
            <div className="mt-2">
              <Input
                placeholder="Search by make, model, registration, or type..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b border-slate-200">
                    <TableHead className="h-10 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">No</TableHead>
                    <TableHead className="h-10 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Registration</TableHead>
                    <TableHead className="h-10 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Horse Reg No</TableHead>
                    <TableHead className="h-10 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Make/Model</TableHead>
                    <TableHead className="h-10 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">ZIM Permit</TableHead>
                    <TableHead className="h-10 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">ZAM Permit</TableHead>
                    <TableHead className="h-10 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Malawi Permit</TableHead>
                    <TableHead className="h-10 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Driver</TableHead>
                    <TableHead className="h-10 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedVehicles.map((vehicle, index) => (
                    <TableRow
                      key={vehicle.id}
                      className="h-12 hover:bg-slate-50 border-b border-slate-100 transition-colors"
                    >
                      <TableCell className="px-3 py-2 text-sm text-slate-500">{(currentPage - 1) * PAGE_SIZE + index + 1}</TableCell>
                      <TableCell className="px-3 py-2 text-sm font-medium text-slate-900">{vehicle.registration_number || '-'}</TableCell>
                      <TableCell className="px-3 py-2 text-sm text-slate-700">{vehicle.horse_reg_no || '-'}</TableCell>
                      <TableCell className="px-3 py-2 text-sm text-slate-700">
                        <div className="flex flex-col">
                          <span className="font-medium">{vehicle.make || '-'}</span>
                          <span className="text-xs text-slate-500">{vehicle.model || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-sm">
                        <Badge className={`${getPermitTone(daysUntil(vehicle.zim_permit_expiry_date))} text-xs px-2 py-0.5 font-medium border`}>
                          {formatPermitDate(vehicle.zim_permit_expiry_date)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-sm">
                        <Badge className={`${getPermitTone(daysUntil(vehicle.zam_permit_expiry_date))} text-xs px-2 py-0.5 font-medium border`}>
                          {formatPermitDate(vehicle.zam_permit_expiry_date)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-sm">
                        <Badge className={`${getPermitTone(daysUntil(vehicle.malawi_permit_expiry_date))} text-xs px-2 py-0.5 font-medium border`}>
                          {formatPermitDate(vehicle.malawi_permit_expiry_date)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2 text-sm text-slate-700">
                        <span className={`text-xs ${vehicle.driver_id ? 'text-slate-700' : 'text-slate-400'}`}>
                          {getAssignedDriverName(vehicle.driver_id)}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              setSelectedVehicle(vehicle);
                              setIsSheetOpen(true);
                            }}
                          >
                            View
                          </Button>
                          <SecureButton 
                            page="vehicles"
                            action="edit"
                            variant="outline" 
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => openEditVehicleForm(vehicle)}
                          >
                            Edit
                          </SecureButton>
                          <SecureButton 
                            page="vehicles"
                            action="edit"
                            variant="outline" 
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={async () => {
                              setEquipmentVehicleReg(vehicle.registration_number || '');
                              await fetchEquipmentData(vehicle.registration_number || '');
                              setIsEquipmentSheetOpen(true);
                            }}
                          >
                            Equipment
                          </SecureButton>
                          <Link href={`/vehicles/${vehicle.id}`}>
                            <Button variant="default" size="sm" className="h-7 px-2 text-xs bg-slate-700 hover:bg-slate-800">Details</Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
                <div className="text-sm text-slate-600">
                  Showing {(filteredVehicles.length === 0) ? 0 : ( (currentPage - 1) * PAGE_SIZE + 1 )} - {Math.min(currentPage * PAGE_SIZE, filteredVehicles.length)} of {filteredVehicles.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </Button>
                  <div className="text-sm text-slate-700 px-2">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      )}

      {/* Vehicle Details Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[600px] max-w-[90vw] p-0 bg-white">
          {selectedVehicle && (
            <>
              {/* Header */}
              <div className="bg-slate-50 border-b border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-slate-700 rounded-lg">
                      {getVehicleTypeIcon(selectedVehicle.vehicle_type)}
                    </div>
                    <div>
                      <SheetTitle className="text-xl font-bold text-slate-900">
                        {selectedVehicle.registration_number || 'Vehicle Details'}
                      </SheetTitle>
                      <p className="text-sm text-slate-600 mt-1">
                        {selectedVehicle.make} {selectedVehicle.model} • {selectedVehicle.manufactured_year}
                      </p>
                    </div>
                  </div>
                  {getPriorityBadge(selectedVehicle.vehicle_priority)}
                </div>
              </div>

              {/* Content */}
              <div className="overflow-y-auto h-[calc(100vh-140px)] p-6 space-y-6">
                {/* Basic Information */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-6 h-6 bg-slate-600 rounded flex items-center justify-center">
                      <Car className="w-3 h-3 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Basic Information</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Registration</p>
                      <p className="text-sm font-medium text-slate-900 mt-1">{selectedVehicle.registration_number || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Horse Reg No</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedVehicle.horse_reg_no || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Engine Number</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedVehicle.engine_number || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">VIN Number</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedVehicle.vin_number || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Color</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedVehicle.colour || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">ZIM Permit</p>
                      <p className="text-sm text-slate-700 mt-1">{formatPermitDate(selectedVehicle.zim_permit_expiry_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">ZAM Permit</p>
                      <p className="text-sm text-slate-700 mt-1">{formatPermitDate(selectedVehicle.zam_permit_expiry_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Malawi Permit</p>
                      <p className="text-sm text-slate-700 mt-1">{formatPermitDate(selectedVehicle.malawi_permit_expiry_date)}</p>
                    </div>
                  </div>
                </div>

                {/* Technical Details */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-6 h-6 bg-slate-600 rounded flex items-center justify-center">
                      <Truck className="w-3 h-3 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Technical Details</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Fuel Type</p>
                      <p className="text-sm text-slate-700 mt-1 capitalize">{selectedVehicle.fuel_type || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Transmission</p>
                      <p className="text-sm text-slate-700 mt-1 capitalize">{selectedVehicle.transmission_type || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tank Capacity</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedVehicle.tank_capacity ? `${selectedVehicle.tank_capacity}L` : '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Service Intervals</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedVehicle.service_intervals || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Financial Information */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-6 h-6 bg-slate-600 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">R</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Financial Information</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Purchase Price</p>
                      <p className="text-sm font-medium text-slate-900 mt-1">{selectedVehicle.purchase_price || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Retail Price</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedVehicle.retail_price || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Monthly Premium</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedVehicle.monthly_premium ? `R ${selectedVehicle.monthly_premium}` : '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Hourly Rate</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedVehicle.hourly_rate ? `R ${selectedVehicle.hourly_rate}` : '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cost Centres</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedVehicle.cost_centres || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Assignment Information */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-6 h-6 bg-slate-600 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">A</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Assignments</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Assigned Driver</p>
                      <p className="text-sm text-slate-700 mt-1">{getAssignedDriverName(selectedVehicle.driver_id)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Assigned Technician</p>
                      <p className="text-sm text-slate-700 mt-1">{
                        technicians.find(t => t.id === selectedVehicle.tech_id)?.name || 'Not Assigned'
                      }</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="border-t border-slate-200 p-4 bg-white">
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSheetOpen(false)}
                    className="text-slate-600 border-slate-300"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Equipment Sheet */}
      <Sheet open={isEquipmentSheetOpen} onOpenChange={setIsEquipmentSheetOpen}>
        <SheetContent className="w-[600px] max-w-[90vw] p-0 bg-white">
          <div className="bg-slate-50 border-b border-slate-200 p-6">
            <SheetTitle className="text-xl font-bold text-slate-900">
              Equipment for {equipmentVehicleReg}
            </SheetTitle>
          </div>
          
          <div className="overflow-y-auto h-[calc(100vh-140px)] p-6">
            {equipmentData.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No equipment found for this vehicle
              </div>
            ) : (
              <div className="space-y-4">
                {equipmentData.map((equipment) => (
                  <Card key={equipment.id} className="bg-slate-50 border border-slate-200">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Registration</p>
                          <p className="text-sm font-medium text-slate-900 mt-1">{equipment.reg || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Skylink Pro IP</p>
                          <p className="text-sm text-slate-700 mt-1">{equipment.skylink_pro_ip || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Industrial Panic</p>
                          <p className="text-sm text-slate-700 mt-1">{equipment.industrial_panic || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Keypad</p>
                          <p className="text-sm text-slate-700 mt-1">{equipment.keypad || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Beame</p>
                          <p className="text-sm text-slate-700 mt-1">{equipment.beame_1 || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Fuel Probe</p>
                          <p className="text-sm text-slate-700 mt-1">{equipment.fuel_probe_1 || '-'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          
          <div className="border-t border-slate-200 p-4 bg-white">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEquipmentSheetOpen(false)}
                className="text-slate-600 border-slate-300"
              >
                Close
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
