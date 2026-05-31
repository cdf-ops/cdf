import { RegistrationPageContent } from "@/app/inscricao/[eventId]/registration-page-content";

type PublicRegistrationPageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function PublicRegistrationPage({ params }: PublicRegistrationPageProps) {
  const { eventId } = await params;
  return <RegistrationPageContent eventId={eventId} />;
}
