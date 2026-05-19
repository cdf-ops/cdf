import { redirect } from "next/navigation";

type LegacyEventExhibitorsPageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function LegacyEventExhibitorsPage({ params }: LegacyEventExhibitorsPageProps) {
  await params;
  redirect("/expositores");
}
