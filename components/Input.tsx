import { forwardRef } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { colors, radius, TOUCH, type } from "../lib/theme";

export const Input = forwardRef<TextInput, TextInputProps>(function Input(props, ref) {
  return <TextInput ref={ref} placeholderTextColor={colors.slate} {...props} style={[st.input, props.multiline && st.multi, props.style]} />;
});

const st = StyleSheet.create({
  input: { minHeight: TOUCH, borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: type.body, color: colors.text, backgroundColor: colors.surface, textAlign: "auto" },
  multi: { minHeight: 96, textAlignVertical: "top" },
});
