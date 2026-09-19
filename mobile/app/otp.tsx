import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Screen,
  Header,
  Txt,
  Button,
  ErrorState,
  Card,
} from "../src/components/ui";
import { Field } from "../src/components/form";
import { request, useAction } from "../src/lib/api";
import { useSession } from "../src/lib/session";
const schema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export default function Otp() {
  const params = useLocalSearchParams<{
    phone: string;
    challenge: string;
    development: string;
  }>();
  const [challenge, setChallenge] = useState(params.challenge);
  const [resent, setResent] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
  });
  const action = useAction(async ({ code }: z.infer<typeof schema>) => {
    const tokens = await request<{
      access_token: string;
      refresh_token: string;
    }>(
      "/auth/otp/verify",
      {
        method: "POST",
        body: JSON.stringify({
          phone: params.phone,
          challenge_id: challenge,
          code,
        }),
      },
      false,
    );
    await useSession.getState().setTokens(tokens);
    router.replace("/properties");
  });
  const resend = useAction(async () => {
    const result = await request<{ challenge_id: string }>(
      "/auth/otp/request",
      { method: "POST", body: JSON.stringify({ phone: params.phone }) },
      false,
    );
    setChallenge(result.challenge_id);
    setResent(true);
  });
  return (
    <Screen>
      <Header title="Verify your number" />
      <Txt muted>
        Enter the code sent to {params.phone}. It expires in 5 minutes.
      </Txt>
      <Field
        control={form.control}
        name="code"
        label="Verification code"
        placeholder="6-digit code"
        keyboardType="number-pad"
        maxLength={6}
      />
      {params.development === "true" && (
        <Card>
          <Txt weight="semibold">Development login</Txt>
          <Txt muted>Use code 123456. No SMS is sent in development.</Txt>
        </Card>
      )}
      <ErrorState error={action.error || resend.error} />
      <Button
        title="Verify & continue"
        loading={action.isPending}
        onPress={form.handleSubmit((v) => action.mutate(v))}
      />
      <Button
        title={resent ? "Send another code" : "Resend code"}
        secondary
        loading={resend.isPending}
        onPress={() => resend.mutate()}
      />
      {resent && <Txt muted>A new code is ready.</Txt>}
    </Screen>
  );
}
