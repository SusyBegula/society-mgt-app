import { View } from "react-native";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import {
  Screen,
  Header,
  Txt,
  Button,
  ErrorState,
  Icon,
  Card,
} from "../src/components/ui";
import { Field } from "../src/components/form";
import { request, useAction } from "../src/lib/api";
import { colors as c } from "../src/theme";
const schema = z.object({
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
});
export default function Login() {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { mobile: "" },
  });
  const action = useAction(async (data: z.infer<typeof schema>) => {
    const result = await request<{
      challenge_id: string;
      development: boolean;
    }>(
      "/auth/otp/request",
      { method: "POST", body: JSON.stringify({ phone: `+91${data.mobile}` }) },
      false,
    );
    router.push({
      pathname: "/otp",
      params: {
        phone: `+91${data.mobile}`,
        challenge: result.challenge_id,
        development: String(result.development),
      },
    });
  });
  return (
    <Screen>
      <Header title="" />
      <View
        style={{
          width: 70,
          height: 70,
          borderRadius: 22,
          backgroundColor: c.pale,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 22,
        }}
      >
        <Icon name="phone-portrait-outline" size={32} />
      </View>
      <Txt weight="extra" style={{ fontSize: 31, lineHeight: 40 }}>
        Welcome home.
      </Txt>
      <Txt muted>
        Enter your mobile number. We'll send a one-time code to get you started.
      </Txt>
      <View style={{ marginTop: 20 }}>
        <Field
          control={form.control}
          name="mobile"
          label="Mobile number · India (+91)"
          placeholder="Your 10-digit number"
          keyboardType="phone-pad"
          maxLength={10}
        />
      </View>
      <ErrorState error={action.error} />
      <Button
        title="Send verification code"
        loading={action.isPending}
        onPress={form.handleSubmit((v) => action.mutate(v))}
      />
      <Card style={{ backgroundColor: c.pale, borderWidth: 0 }}>
        <Txt style={{ fontSize: 12 }}>
          Your number is used to find the properties you belong to. It is never
          shared in the public directory.
        </Txt>
      </Card>
    </Screen>
  );
}
