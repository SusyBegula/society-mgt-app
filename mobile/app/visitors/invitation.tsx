import { useState } from "react";
import { Share, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useLocalSearchParams } from "expo-router";
import {
  Screen,
  Header,
  Card,
  Txt,
  Badge,
  DetailRow,
  Button,
  Loading,
  ErrorState,
  Confirm,
} from "../../src/components/ui";
import { useApi, useAction, send } from "../../src/lib/api";
import { useSession } from "../../src/lib/session";
import { date, time } from "../../src/lib/format";
import type { Invitation } from "../../src/types/api";
export default function InvitationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useApi<Invitation>(`/visitors/invitations/${id}`);
  const property = useSession((s) => s.property)!;
  const [confirm, setConfirm] = useState(false);
  const cancel = useAction(async () => {
    await send(`/visitors/invitations/${id}`, "DELETE");
    setConfirm(false);
  });
  const share = useAction(async () => {
    const d = query.data!;
    await Share.share({
      message: `You're invited to ${property.society}, ${property.tower}, Flat ${property.flat}.\nGuest: ${d.name}\n${date(d.start_at)}, ${time(d.start_at)}–${time(d.end_at)}\nEntry PIN: ${d.pin}\nPlease show this invitation at the gate.\n${d.notes}`,
    });
  });
  const d = query.data;
  return (
    <Screen>
      <Header title="Visitor pass" />
      {query.isLoading && <Loading />}
      <ErrorState
        error={query.error || cancel.error || share.error}
        retry={query.refetch}
      />
      {d && (
        <>
          <Card>
            <View
              style={{ alignItems: "center", gap: 17, paddingVertical: 10 }}
            >
              <Badge status={d.status} />
              <Txt weight="extra" style={{ fontSize: 23 }}>
                {d.name}
              </Txt>
              <Txt muted>{property.society}</Txt>
              {d.status === "Active" && (
                <QRCode
                  value={JSON.stringify({
                    v: 1,
                    type: "society-invitation",
                    token: d.qr_token,
                  })}
                  size={180}
                  color="#203B34"
                  backgroundColor="#FFFFFF"
                />
              )}
              <Txt muted>ENTRY PIN</Txt>
              <Txt
                weight="extra"
                style={{ fontSize: 34, lineHeight: 42, letterSpacing: 7 }}
              >
                {d.pin}
              </Txt>
            </View>
            <DetailRow
              label="Flat"
              value={`${property.tower} · ${property.flat}`}
            />
            <DetailRow label="Visit" value={date(d.start_at)} />
            <DetailRow
              label="Valid between"
              value={`${time(d.start_at)}–${time(d.end_at)}`}
            />
            <DetailRow label="Mobile" value={d.phone} />
            {d.vehicle_number && (
              <DetailRow label="Vehicle" value={d.vehicle_number} />
            )}
            {d.notes && <Txt muted>{d.notes}</Txt>}
          </Card>
          {d.status === "Active" && (
            <>
              <Button
                title="Share invitation"
                icon="share-outline"
                loading={share.isPending}
                onPress={() => share.mutate()}
              />
              <Button
                title="Cancel invitation"
                secondary
                danger
                onPress={() => setConfirm(true)}
              />
            </>
          )}
        </>
      )}
      <Confirm
        visible={confirm}
        title="Cancel this invitation?"
        message="The entry PIN and QR code will no longer be valid."
        onCancel={() => setConfirm(false)}
        onConfirm={() => cancel.mutate()}
        loading={cancel.isPending}
        danger
      />
    </Screen>
  );
}
