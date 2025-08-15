import { WifiOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-md mx-auto text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <WifiOff className="h-16 w-16 text-gray-400" />
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900">
            Sin conexión a internet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            No tienes conexión a internet en este momento.
          </p>
          <p className="text-sm text-gray-500">
            Los últimos resultados guardados se mostrarán cuando vuelvas a estar online.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}