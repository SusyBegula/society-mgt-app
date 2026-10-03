import { useState } from "react";
import { router } from "expo-router";
import {
  Screen,
  Header,
  Card,
  Txt,
  Row,
  Badge,
  Button,
  Chips,
  Loading,
  ErrorState,
  Empty,
  Icon,
} from "../../src/components/ui";
import { usePages, send, useAction } from "../../src/lib/api";
import { money, date } from "../../src/lib/format";
import type { Bill, Payment } from "../../src/types/api";
import { colors as c } from "../../src/theme";
export default function Payments() {
  const [tab, setTab] = useState("Bills");
  const bills = usePages<Bill>("/bills");
  const payments = usePages<Payment>("/payments");
  const query = tab === "Bills" ? bills : payments;
  const reconcile = useAction((id: string) =>
    send(`/payments/${id}/reconcile`, "POST"),
  );
  return (
    <Screen refresh={query.refetch} refreshing={query.isRefetching}>
      <Header
        title="Payments"
        subtitle="A clear picture of your dues."
        back={false}
      />
      <Button title="Refund requests" secondary onPress={()=>router.push("/refunds" as never)} />
      <Chips
        options={["Bills", "Payment history"]}
        value={tab}
        onChange={setTab}
      />
      {query.isLoading && <Loading />}
      <ErrorState
        error={query.error || reconcile.error}
        retry={query.refetch}
      />
      {tab === "Bills"
        ? bills.data?.pages
            .flatMap((p) => p.items)
            .map((bill) => (
              <Card
                key={bill.id}
                onPress={() => router.push(`/bills/${bill.id}`)}
              >
                <Row style={{ justifyContent: "space-between" }}>
                  <Row>
                    <Icon name="receipt-outline" />
                    <Txt weight="bold">{bill.period}</Txt>
                  </Row>
                  <Badge status={bill.status} />
                </Row>
                <Txt weight="extra" style={{ fontSize: 29, lineHeight: 36 }}>
                  {money(bill.outstanding || bill.amount)}
                </Txt>
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt muted style={{ fontSize: 12 }}>
                    Due {date(bill.due_date)}
                  </Txt>
                  <Txt weight="bold" style={{ color: c.primary, fontSize: 12 }}>
                    {bill.outstanding ? "View & pay  →" : "View bill  →"}
                  </Txt>
                </Row>
              </Card>
            ))
        : payments.data?.pages
            .flatMap((p) => p.items)
            .map((payment) => (
              <Card key={payment.id}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt weight="bold">{payment.period}</Txt>
                  <Badge status={payment.status} />
                </Row>
                <Txt weight="extra" style={{ fontSize: 26, lineHeight: 33 }}>
                  {money(payment.amount)}
                </Txt>
                <Txt muted style={{ fontSize: 12 }}>
                  {date(payment.paid_at ?? payment.created_at)} ·{" "}
                  {payment.method || "Online payment"}
                </Txt>
                {payment.reference && (
                  <Txt muted style={{ fontSize: 10 }}>
                    {payment.reference}
                  </Txt>
                )}
                {payment.status === "Paid" ? (
                  <Button
                    title="View receipt"
                    secondary
                    icon="document-text-outline"
                    onPress={() => router.push(`/receipt/${payment.id}`)}
                  />
                ) : (
                  <Button
                    title="Check payment status"
                    secondary
                    loading={reconcile.isPending}
                    onPress={() => reconcile.mutate(payment.id)}
                  />
                )}
              </Card>
            ))}
      {query.data?.pages[0]?.total === 0 && (
        <Empty
          title={
            tab === "Bills"
              ? "All maintenance dues are cleared"
              : "No payments yet"
          }
          description="Your payment records will appear here."
          icon="wallet-outline"
        />
      )}
      {query.hasNextPage && (
        <Button
          title="Load more"
          secondary
          loading={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </Screen>
  );
}
