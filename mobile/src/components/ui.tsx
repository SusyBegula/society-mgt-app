import React, { type ReactNode, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ColorValue,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors as c, fonts } from "../theme";
import { initials } from "../lib/format";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export function Icon({
  name,
  size = 22,
  color = c.primary,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function Txt({
  children,
  style,
  muted = false,
  weight = "regular",
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
  weight?: keyof typeof fonts;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: fonts[weight],
          fontSize: 14,
          lineHeight: 22,
          color: muted ? c.muted : c.ink,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Screen({
  children,
  refresh,
  refreshing = false,
  style,
}: {
  children: ReactNode;
  refresh?: () => void;
  refreshing?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.background }}
      edges={["top", "left", "right"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.screen, style]}
          refreshControl={
            refresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={c.primary}
                colors={[c.primary]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Header({
  title,
  subtitle,
  back = true,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={s.header}>
      {back && (
        <IconButton
          name="arrow-back"
          label="Go back"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        />
      )}
      <View style={{ flex: 1 }}>
        <Txt weight="extra" style={{ fontSize: 25, lineHeight: 33 }}>
          {title}
        </Txt>
        {subtitle && (
          <Txt muted style={{ fontSize: 12 }}>
            {subtitle}
          </Txt>
        )}
      </View>
      {right}
    </View>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  dot = false,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  dot?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.iconButton, pressed && { opacity: 0.65 }]}
    >
      <Icon name={name} />
      {dot && <View style={s.dot} />}
    </Pressable>
  );
}
export function Button({
  title,
  onPress,
  loading,
  disabled,
  secondary,
  danger,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const color = secondary ? (danger ? c.red : c.primary) : "#fff";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: secondary
            ? danger
              ? c.redBg
              : c.pale
            : danger
              ? c.red
              : c.primary,
        },
        (disabled || loading) && { opacity: 0.55 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        icon && <Icon name={icon} color={color} size={19} />
      )}
      <Txt weight="bold" style={{ color, textAlign: "center" }}>
        {title}
      </Txt>
    </Pressable>
  );
}
export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.card, style, pressed && { opacity: 0.8 }]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={[s.card, style]}>{children}</View>
  );
}
export function Row({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[s.row, style]}>{children}</View>;
}
export function Badge({ status }: { status: string }) {
  const good =
    /Paid|Allowed|Confirmed|Active|Resolved|Closed|Inside|Owner|Success/.test(
      status,
    ) && !/Partially/.test(status);
  const bad = /Denied|Cancelled|Overdue|Urgent|Failed|Expired/.test(status);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 7,
        backgroundColor: good ? c.pale : bad ? c.redBg : c.amberBg,
      }}
    >
      <Txt
        weight="semibold"
        style={{
          fontSize: 10,
          lineHeight: 16,
          color: good ? c.primary : bad ? c.red : c.amber,
        }}
      >
        {status}
      </Txt>
    </View>
  );
}
export function Avatar({ name, size = 46 }: { name: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.lime,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt weight="bold" style={{ color: c.primary, fontSize: size * 0.31 }}>
        {initials(name)}
      </Txt>
    </View>
  );
}
export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <Row style={{ justifyContent: "space-between", marginTop: 9 }}>
      <Txt weight="bold" style={{ fontSize: 17 }}>
        {title}
      </Txt>
      {action && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{ paddingVertical: 12, paddingLeft: 12 }}
        >
          <Txt weight="semibold" style={{ color: c.primary, fontSize: 12 }}>
            {action} →
          </Txt>
        </Pressable>
      )}
    </Row>
  );
}
export function Empty({
  title,
  description,
  icon = "leaf-outline",
}: {
  title: string;
  description?: string;
  icon?: IconName;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Icon name={icon} size={30} />
      </View>
      <Txt weight="bold" style={{ textAlign: "center", fontSize: 16 }}>
        {title}
      </Txt>
      {description && (
        <Txt muted style={{ textAlign: "center", maxWidth: 270 }}>
          {description}
        </Txt>
      )}
    </View>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error | null;
  retry?: () => void;
}) {
  return error ? (
    <Card style={{ backgroundColor: c.redBg, gap: 12 }}>
      <Row>
        <Icon name="alert-circle-outline" color={c.red} />
        <Txt style={{ color: c.red, flex: 1 }}>{error.message}</Txt>
      </Row>
      {retry && <Button title="Try again" secondary onPress={retry} />}
    </Card>
  ) : null;
}
export function Loading() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);
  return (
    <Animated.View
      accessibilityLabel="Loading content"
      style={{ gap: 16, opacity }}
    >
      {[150, 85, 85].map((height, i) => (
        <View
          key={i}
          style={{ height, backgroundColor: c.line, borderRadius: 20 }}
        />
      ))}
    </Animated.View>
  );
}
export function ListItem({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        s.listItem,
        pressed && onPress && { opacity: 0.6 },
      ]}
    >
      <View style={[s.listIcon, danger && { backgroundColor: c.redBg }]}>
        <Icon name={icon} color={danger ? c.red : c.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt weight="semibold" style={danger ? { color: c.red } : undefined}>
          {title}
        </Txt>
        {subtitle && (
          <Txt muted style={{ fontSize: 12 }}>
            {subtitle}
          </Txt>
        )}
      </View>
      {right ??
        (onPress && <Icon name="chevron-forward" color={c.muted} size={18} />)}
    </Pressable>
  );
}
export function Divider() {
  return <View style={{ height: 1, backgroundColor: c.line }} />;
}
export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <Row
      style={{
        justifyContent: "space-between",
        alignItems: "flex-start",
        paddingVertical: 8,
      }}
    >
      <Txt muted style={{ flex: 1, fontSize: 12 }}>
        {label}
      </Txt>
      <Txt
        weight="semibold"
        style={{ flex: 1.3, textAlign: "right", fontSize: 12 }}
      >
        {value}
      </Txt>
    </Row>
  );
}
export function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((option) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: value === option }}
          key={option}
          onPress={() => onChange(option)}
          style={{
            borderRadius: 11,
            paddingHorizontal: 15,
            minHeight: 44,
            justifyContent: "center",
            backgroundColor: value === option ? c.primary : c.surface,
            borderWidth: 1,
            borderColor: value === option ? c.primary : c.line,
          }}
        >
          <Txt
            weight="semibold"
            style={{ fontSize: 12, color: value === option ? "#fff" : c.muted }}
          >
            {option}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}
export function Confirm({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  loading,
  danger = false,
  confirmTitle = "Confirm",
}: {
  visible: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
  danger?: boolean;
  confirmTitle?: string;
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={s.overlay}>
        <View style={s.modal}>
          <View style={s.emptyIcon}>
            <Icon
              name={danger ? "alert-outline" : "checkmark-outline"}
              size={30}
              color={danger ? c.red : c.primary}
            />
          </View>
          <Txt weight="extra" style={{ fontSize: 22, lineHeight: 30 }}>
            {title}
          </Txt>
          <Txt muted>{message}</Txt>
          <Button
            title={confirmTitle}
            onPress={onConfirm}
            loading={loading}
            danger={danger}
          />
          <Button
            title="Cancel"
            onPress={onCancel}
            secondary
            disabled={loading}
          />
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  screen: { padding: 22, paddingBottom: 40, gap: 18, flexGrow: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
    marginBottom: 5,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  card: {
    borderRadius: 20,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    padding: 18,
    gap: 12,
  },
  button: {
    minHeight: 52,
    borderRadius: 13,
    paddingVertical: 13,
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },
  iconButton: {
    height: 46,
    width: 46,
    borderRadius: 15,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    right: 12,
    top: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: c.amber,
    borderWidth: 1,
    borderColor: "#fff",
  },
  empty: { alignItems: "center", paddingVertical: 32, gap: 12 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: c.pale,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 13,
    minHeight: 64,
  },
  listIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: c.pale,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    backgroundColor: "#0C251C80",
    justifyContent: "center",
    padding: 24,
  },
  modal: { backgroundColor: c.surface, borderRadius: 26, padding: 25, gap: 16 },
});
