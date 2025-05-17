import Image from "next/image";
import Clock from "./components/Clock";
import ToggleButton from "./components/ToggleButton";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 p-8 relative">
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Clock />
        <div className="mt-8">
          <ToggleButton id="main-toggle" />
        </div>
      </div>
    </div>
  );
}
