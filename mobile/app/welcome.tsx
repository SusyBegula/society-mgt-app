import { View } from "react-native";
import { router } from "expo-router";
import { Screen, Txt, Row, Icon, Button } from "../src/components/ui";
import { colors as c } from "../src/theme";

export default function Welcome() {
  return (
    <Screen style={{ justifyContent: "space-between", paddingTop: 32 }}>
      <Row>
        <View
          style={{ backgroundColor: c.primary, padding: 10, borderRadius: 13 }}
        >
          <Icon name="leaf" color={c.lime} />
        </View>
        <Txt weight="extra" style={{ fontSize: 22 }}>
          neighbourly
        </Txt>
      </Row>
      <View style={{ paddingVertical: 28, alignItems: "center" }}>
        <View
          style={{
            width: "100%",
            aspectRatio: 1.12,
            backgroundColor: "#E9F0DF",
            borderRadius: 140,
            justifyContent: "flex-end",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 32,
              right: 42,
              width: 46,
              height: 46,
              borderRadius: 30,
              backgroundColor: "#EDD6A7",
            }}
          />
          <Row style={{ alignItems: "flex-end", gap: 10, marginBottom: -2 }}>
            {[132, 195, 160].map((height, i) => (
              <View
                key={i}
                style={{
                  height,
                  width: "25%",
                  backgroundColor: [c.primary, "#7A9B74", "#B2C69A"][i],
                  borderTopLeftRadius: 15,
                  borderTopRightRadius: 15,
                  padding: 13,
                  gap: 12,
                }}
              >
                {Array.from({ length: i === 1 ? 4 : 3 }).map((_, j) => (
                  <Row key={j} style={{ gap: 9 }}>
                    <View
                      style={{
                        flex: 1,
                        height: 18,
                        backgroundColor: "#F3F5DFB0",
                        borderRadius: 3,
                      }}
                    />
                    <View
                      style={{
                        flex: 1,
                        height: 18,
                        backgroundColor: "#F3F5DFB0",
                        borderRadius: 3,
                      }}
                    />
                  </Row>
                ))}
              </View>
            ))}
          </Row>
        </View>
        <View
          style={{
            backgroundColor: c.surface,
            borderRadius: 20,
            paddingVertical: 12,
            paddingHorizontal: 18,
            marginTop: -25,
            flexDirection: "row",
            gap: 10,
            borderWidth: 1,
            borderColor: c.line,
          }}
        >
          <Icon name="heart-outline" size={18} />
          <Txt weight="semibold" style={{ fontSize: 12 }}>
            A little closer to your community
          </Txt>
        </View>
      </View>
      <View style={{ gap: 18 }}>
        <Txt weight="extra" style={{ fontSize: 37, lineHeight: 46 }}>
          Home is more{"\n"}than your address.
        </Txt>
        <Txt muted style={{ fontSize: 15, lineHeight: 25 }}>
          Your home, your people, your everyday.{"\n"}Manage society life with a
          little more ease.
        </Txt>
        <Button
          title="Let's get started"
          icon="arrow-forward"
          onPress={() => router.push("/login")}
        />
        <Txt muted style={{ fontSize: 10, textAlign: "center" }}>
          BUILT FOR THE PLACE YOU CALL HOME
        </Txt>
      </View>
    </Screen>
  );
}
