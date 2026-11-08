import { APP_TITLE } from "@/lib/app-config";
import { RentRollApp } from "@/components/rent-roll/RentRollApp";

export function meta() {
  return [
    { title: APP_TITLE },
    { name: "description", content: "A calm weekly rent and property brief." },
  ];
}

export default function HomeRoute() {
  return <RentRollApp />;
}