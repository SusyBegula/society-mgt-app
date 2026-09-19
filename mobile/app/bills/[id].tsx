import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import RazorpayCheckout from "react-native-razorpay";
import {
  Screen,
  Header,
  Card,
  Txt,
  Row,
  Badge,
  DetailRow,
  Divider,
  Button,
  Loading,
  ErrorState,
  Confirm,
} from "../../src/components/ui";
import { useApi, useAction, send } from "../../src/lib/api";
import { money, date } from "../../src/lib/format";
import { useSession } from "../../src/lib/session";
import { colors as c } from "../../src/theme";
import type { Bill, Payment, Profile } from "../../src/types/api";
export default function BillDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useApi<Bill>(`/bills/${id}`);
  const profile = useApi<Profile>("/residents/me");
  const property = useSession((s) => s.property)!;
  const [demo, setDemo] = useState<Payment | null>(null);
  const pay = useAction(async () => {
    const order = await send<Payment>("/payments/orders", "POST", {
      bill_id: id,
    });
    if (order.provider === "development") {
      setDemo(order);
      return;
    }
    let result;
    try {
      result = await RazorpayCheckout.open({
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount,
        currency: "INR",
        name: property.society,
        description: `Maintenance · ${query.data?.period}`,
        prefill: {
          name: profile.data?.name,
          contact: profile.data?.phone,
          email: profile.data?.email,
        },
        theme: { color: c.primary },
      });
    } catch {
      throw new Error(
        "Payment was cancelled or could not be completed. If money was debited, check payment history before trying again.",
      );
    }
    const payment = await send<Payment>("/payments/verify", "POST", {
      payment_id: order.id,
      razorpay_payment_id: result.razorpay_payment_id,
      razorpay_signature: result.razorpay_signature,
    });
    if (payment.status === "Paid") router.replace(`/receipt/${payment.id}`);
    else
      throw new Error(
        "Your payment needs review. Please contact the society office.",
      );
  });
  const simulate = useAction(async () => {
    const payment = await send<Payment>(
      `/payments/${demo!.id}/simulate`,
      "POST",
    );
    setDemo(null);
    router.replace(`/receipt/${payment.id}`);
  });
  const bill = query.data;
  return (
    <Screen>
      <Header title="Maintenance bill" />
      {query.isLoading && <Loading />}
      <ErrorState
        error={query.error || pay.error || simulate.error}
        retry={query.refetch}
      />
      {bill && (
        <>
          <Card>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt weight="bold" style={{ fontSize: 18 }}>
                {bill.period}
              </Txt>
              <Badge status={bill.status} />
            </Row>
            <Txt muted>
              {property.society} · {property.tower} · {property.flat}
            </Txt>
            <Txt weight="extra" style={{ fontSize: 39, lineHeight: 49 }}>
              {money(bill.amount)}
            </Txt>
            <Txt muted>Due {date(bill.due_date)}</Txt>
          </Card>
          <Card>
            <Txt weight="bold" style={{ fontSize: 17 }}>
              Charge breakdown
            </Txt>
            {bill.items?.map((item) => (
              <DetailRow
                key={item.id}
                label={item.label}
                value={money(item.amount)}
              />
            ))}
            <Divider />
            <DetailRow label="Total" value={money(bill.amount)} />
            <DetailRow
              label="Already paid"
              value={money(bill.amount - bill.outstanding)}
            />
            <DetailRow label="Outstanding" value={money(bill.outstanding)} />
          </Card>
          {bill.outstanding > 0 && (
            <>
              <Button
                title={`Pay ${money(bill.outstanding)}`}
                icon="lock-closed-outline"
                loading={pay.isPending}
                onPress={() => pay.mutate()}
              />
              <Txt muted style={{ textAlign: "center", fontSize: 11 }}>
                UPI · Cards · Net banking{"\n"}Payments are confirmed securely
                by the server.
              </Txt>
            </>
          )}
        </>
      )}
      <Confirm
        visible={!!demo}
        title="Development payment"
        message={`Simulate a successful payment of ${money(demo?.amount ?? 0)}? No money will be collected.`}
        onCancel={() => setDemo(null)}
        onConfirm={() => simulate.mutate()}
        loading={simulate.isPending}
        confirmTitle="Simulate payment"
      />
    </Screen>
  );
}
