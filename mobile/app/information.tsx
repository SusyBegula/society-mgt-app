import { useLocalSearchParams, router } from "expo-router";
import { useApi } from "../src/lib/api";
import { Screen, Header, Card, Txt, Button } from "../src/components/ui";
const content: Record<string, { title: string; paragraphs: string[] }> = {
  help: {
    title: "Help & support",
    paragraphs: [
      "Need help with your flat, a bill, or a society service? Contact your society office from the directory.",
      "For maintenance issues, raise a complaint and follow the updates in your complaint timeline. If a payment was debited but is not confirmed, use “Check payment status” in payment history before paying again.",
      "For urgent assistance, call security or emergency services directly.",
    ],
  },
  privacy: {
    title: "Privacy & your data",
    paragraphs: [
      "Your phone number is used to sign you in and find your property memberships. Residents cannot browse other residents’ private contact details.",
      "Bills, visitors, complaints, vehicles, and family records are restricted to authorized residents of the associated flat. Society notices, amenities, and permitted documents are available within your society.",
      "Your device stores session credentials securely. Payment credentials are processed by the payment provider. For questions about your records or to request a correction, contact your society office.",
      "This is a development application. Your society’s published privacy policy and retention arrangements must be configured before a public launch.",
    ],
  },
  terms: {
    title: "Terms of use",
    paragraphs: [
      "Use this application to manage the properties you are authorized to access. Keep visitor and household information accurate and follow your society’s amenity and cancellation rules.",
      "Development payments simulate transactions and do not collect money. Live payment terms, refunds, and grievance contacts are supplied by your society when online payments are enabled.",
      "Application emergency alerts do not dispatch emergency services. Call the appropriate service for immediate assistance.",
      "This development build contains sample operating information. Society-specific terms must be published before a public launch.",
    ],
  },
};
export default function Information() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const society = useApi<{settings:{privacy_policy?:string;terms?:string}}>("/societies/current");
  const published = type === "privacy" ? society.data?.settings?.privacy_policy : type === "terms" ? society.data?.settings?.terms : undefined;
  const data = published ? {title: content[type].title, paragraphs: published.split("\n").filter(Boolean)} : content[type] ?? content.help;
  return (
    <Screen>
      <Header title={data.title} />
      <Card style={{ padding: 23, gap: 21 }}>
        {data.paragraphs.map((paragraph) => (
          <Txt key={paragraph} style={{ lineHeight: 26 }}>
            {paragraph}
          </Txt>
        ))}
      </Card>
      <Button
        title="Contact society office"
        secondary
        icon="call-outline"
        onPress={() => router.push("/directory")}
      />
    </Screen>
  );
}
