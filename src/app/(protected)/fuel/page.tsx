// import { FetchDataSteps } from "@/components/tutorial/fetch-data-steps";
import { MainLayout } from '@/components/fuel-system/components/layout/MainLayout';
import { AppProvider } from '@/components/fuel-system/contexts/AppContext';
import { UserProvider } from '@/components/fuel-system/contexts/UserContext';
//src\components\fuel-system\contexts\UserContext.tsx

export default async function FuelPage() {

  return (
    <UserProvider>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </UserProvider>
  );
}
