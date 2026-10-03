import { Redirect, Tabs } from "expo-router";
import { useSession } from "../../src/lib/session";
import { Icon, type IconName } from "../../src/components/ui";
import { colors, fonts } from "../../src/theme";
import { t } from "../../src/lib/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const property = useSession((s) => s.property);
  if (!property) return <Redirect href="/properties" />;
  if (property.role === "Guard") return <Redirect href="/guard" />;
  if (property.role === "Secretary" || property.role === "Admin" || property.role === "Treasurer") {
    return <Redirect href="/admin" />;
  }
  const tabs: {
    name: string;
    title: string;
    icon: IconName;
    active: IconName;
  }[] = [
    { name: "index", title: t("home"), icon: "home-outline", active: "home" },
    {
      name: "visitors",
      title: t("visitors"),
      icon: "people-outline",
      active: "people",
    },
    {
      name: "payments",
      title: t("payments"),
      icon: "wallet-outline",
      active: "wallet",
    },
    {
      name: "complaints",
      title: t("complaints"),
      icon: "chatbox-ellipses-outline",
      active: "chatbox-ellipses",
    },
    { name: "more", title: t("more"), icon: "grid-outline", active: "grid" },
  ];
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: colors.line,
          paddingTop: 9,
          height: 70 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: fonts.bold,
          marginTop: 3,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <Icon
                name={focused ? tab.active : tab.icon}
                color={color}
                size={23}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
