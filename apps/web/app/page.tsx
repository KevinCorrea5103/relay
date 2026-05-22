import { redirect } from "next/navigation";
import { defaultLocale } from "@/lib/dict";

export default function RootIndex() {
  redirect(`/${defaultLocale}`);
}
