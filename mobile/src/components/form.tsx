import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { TextInput, View, type KeyboardTypeOptions } from "react-native";
import { Txt, Chips } from "./ui";
import { colors as c, fonts } from "../theme";

export function Field<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  multiline,
  keyboardType,
  secureTextEntry,
  maxLength,
  autoCapitalize = "sentences",
}: {
  control: Control<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  maxLength?: number;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View style={{ gap: 8 }}>
          <Txt weight="semibold" style={{ fontSize: 12 }}>
            {label}
          </Txt>
          <TextInput
            accessibilityLabel={label}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={placeholder}
            placeholderTextColor="#9BA69F"
            multiline={multiline}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
            maxLength={maxLength}
            autoCapitalize={autoCapitalize}
            style={{
              fontFamily: fonts.medium,
              fontSize: 14,
              color: c.ink,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: fieldState.error ? c.red : c.line,
              borderRadius: 13,
              padding: 16,
              minHeight: multiline ? 125 : 54,
              textAlignVertical: multiline ? "top" : "center",
            }}
          />
          {fieldState.error && (
            <Txt style={{ color: c.red, fontSize: 12 }}>
              {fieldState.error.message}
            </Txt>
          )}
        </View>
      )}
    />
  );
}
export function ChoiceField<T extends FieldValues>({
  control,
  name,
  label,
  options,
}: {
  control: Control<T>;
  name: Path<T>;
  label: string;
  options: string[];
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View style={{ gap: 9 }}>
          <Txt weight="semibold" style={{ fontSize: 12 }}>
            {label}
          </Txt>
          <Chips
            options={options}
            value={field.value}
            onChange={field.onChange}
          />
          {fieldState.error && (
            <Txt style={{ color: c.red }}>{fieldState.error.message}</Txt>
          )}
        </View>
      )}
    />
  );
}
