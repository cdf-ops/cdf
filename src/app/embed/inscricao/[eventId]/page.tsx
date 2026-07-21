import { RegistrationPageContent } from "@/app/inscricao/[eventId]/registration-page-content";

type EmbeddedRegistrationPageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function EmbeddedRegistrationPage({ params }: EmbeddedRegistrationPageProps) {
  const { eventId } = await params;
  return <RegistrationPageContent eventId={eventId} embedded />;
}
