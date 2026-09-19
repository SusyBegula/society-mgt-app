import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  Screen,
  Header,
  Card,
  Txt,
  Icon,
  DetailRow,
  Divider,
  Button,
  Loading,
  ErrorState,
} from "../../src/components/ui";
import { useApi, useAction } from "../../src/lib/api";
import { shareFile } from "../../src/lib/files";
import { money, date, time } from "../../src/lib/format";
import { colors as c } from "../../src/theme";
import type { Receipt } from "../../src/types/api";
export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useApi<Receipt>(`/payments/${id}/receipt`);
  const download = useAction(() =>
    shareFile(`/payments/${id}/receipt.pdf`, `receipt-${id}.pdf`),
  );
  const data = query.data;
  return (
    <Screen>
      <Header title="Payment receipt" />
      {query.isLoading && <Loading />}
      <ErrorState error={query.error || download.error} retry={query.refetch} />
      {data && (
        <>
          <Card style={{ padding: 24 }}>
            <View
              style={{ alignItems: "center", gap: 14, paddingVertical: 15 }}
            >
              <View
                style={{
                  width: 74,
                  height: 74,
                  borderRadius: 40,
                  backgroundColor: c.pale,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="checkmark" size={37} />
              </View>
              <Txt weight="bold" style={{ fontSize: 21 }}>
                Payment successful
              </Txt>
              <Txt weight="extra" style={{ fontSize: 40, lineHeight: 48 }}>
                {money(data.amount)}
              </Txt>
              <Txt muted style={{ fontSize: 12 }}>
                Thank you for keeping your community going.
              </Txt>
            </View>
            <Divider />
            <DetailRow label="Society" value={data.society} />
            <DetailRow label="Resident" value={data.resident} />
            <DetailRow label="Flat" value={data.flat} />
            <DetailRow label="Billing period" value={data.period} />
            <DetailRow
              label="Payment date"
              value={`${date(data.paid_at)} ${time(data.paid_at)}`}
            />
            <DetailRow label="Payment method" value={data.method} />
            <DetailRow label="Transaction reference" value={data.reference} />
            <Divider />
            <Txt muted style={{ fontSize: 10, textAlign: "center" }}>
              {data.provider === "development"
                ? "DEVELOPMENT RECEIPT · NO MONEY COLLECTED"
                : "Digitally generated payment receipt"}
            </Txt>
          </Card>
          <Button
            title="Share receipt"
            icon="share-outline"
            loading={download.isPending}
            onPress={() => download.mutate()}
          />
          <Button
            title="Download PDF"
            icon="download-outline"
            secondary
            loading={download.isPending}
            onPress={() => download.mutate()}
          />
          <Txt muted style={{ fontSize: 11, textAlign: "center" }}>
            Choose a destination from your device's save or share menu.
          </Txt>
        </>
      )}
    </Screen>
  );
}
