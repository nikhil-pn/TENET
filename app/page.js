import Image from "next/image";
import Clock from "./components/Clock";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-8">TENET</h1>
      <div className="flex flex-col items-center">
        <h2 className="text-3xl font-semibold mb-8 text-gray-800">
          Skeuomorphism
        </h2>
        <Clock />
      </div>
    </div>
  );
}
