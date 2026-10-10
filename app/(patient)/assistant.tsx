// "Assistant DjiHealth" — AI agent that helps the patient find information in their own record.
// All safety work happens server-side (record-assistant Edge Function); this screen only displays
// validated answers, the AI label and source chips.
import { router } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Input } from "../../components/Input";
import { SourceChips } from "../../components/SourceChips";
import { Badge, Button, Icon, Notice, Small } from "../../components/ui";
import { useAssistant, useRecord, type AssistantReply } from "../../lib/api";
import { colors, fonts, MAX_WIDTH, radius, space, TOUCH } from "../../lib/theme";

interface Msg { role: "user" | "assistant"; content: string; reply?: AssistantReply }

const SCREEN_PATHS: Record<string, string> = {
  vault: "/vault", conditions: "/vault/conditions", allergies: "/vault/allergies", medications: "/vault/medications",
  immunizations: "/vault/immunizations", encounters: "/vault/encounters", documents: "/vault/documents",
  emergency_card: "/emergency-card", maternal: "/maternal", children: "/maternal", summary: "/summary", share: "/share", access: "/vault/access",
};

export default function Assistant() {
  const { t, i18n } = useTranslation();
  const rec = useRecord();
  const ask = useAssistant();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const scroll = useRef<ScrollView>(null);

  const suggestions = [
    t("assistant.suggest.allergies"),
    rec.data?.pregnancies.some((p) => p.status === "active") ? t("assistant.suggest.next_visit") : null,
    rec.data?.children.length ? t("assistant.suggest.child_vaccines") : null,
    t("assistant.suggest.medications"),
    t("assistant.suggest.share"),
    t("assistant.suggest.advice"),
  ].filter(Boolean) as string[];

  const send = (text: string) => {
    const content = text.trim();
    if (!content || ask.isPending) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setDraft("");
    ask.mutate(
      { language: i18n.language, messages: next.map((m) => ({ role: m.role, content: m.content })) },
      {
        onSuccess: (reply) => setMsgs((cur) => [...cur, { role: "assistant", content: reply.answer, reply }]),
        onError: (e) => setMsgs((cur) => [...cur, { role: "assistant", content: `${t("assistant.error")} (${e.message})` }]),
        onSettled: () => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50),
      },
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
        <View style={st.inner}>
          <View style={st.header}>
            <Icon name="robot-outline" size={34} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={st.title} accessibilityRole="header">{t("assistant.title")}</Text>
              <Text style={st.subtitle}>{t("assistant.subtitle")}</Text>
            </View>
          </View>
          <Notice tone="warning" icon="shield-alert-outline" title={t("assistant.disclaimer_title")}>{t("assistant.disclaimer")}</Notice>

          {msgs.length === 0 ? (
            <View style={{ gap: space.sm }}>
              <Small muted>{t("assistant.try")}</Small>
              <View style={st.suggestions}>
                {suggestions.map((s) => (
                  <Pressable key={s} accessibilityRole="button" onPress={() => send(s)} style={st.suggestion}>
                    <Text style={st.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {msgs.map((m, i) => (
            <View key={i} style={[st.bubble, m.role === "user" ? st.user : st.bot]} accessibilityLabel={m.role === "user" ? t("assistant.you") : t("assistant.title")}>
              <Text style={[st.bubbleText, m.role === "user" && { color: colors.white }]}>{m.content}</Text>
              {m.reply ? (
                <View style={{ gap: space.sm }}>
                  {m.reply.kind === "out_of_scope" ? <Badge tone="warning" icon="hand-back-left-outline" label={t("assistant.out_of_scope")} /> : null}
                  {m.reply.kind === "fallback" ? <Badge tone="neutral" icon="shield-check-outline" label={t("assistant.blocked")} /> : null}
                  <SourceChips refs={m.reply.source_refs} refMap={m.reply.ref_map} record={rec.data} />
                  {m.reply.screen !== "none" && SCREEN_PATHS[m.reply.screen] ? (
                    <Button variant="secondary" icon="arrow-top-right" label={t("assistant.open_screen")} onPress={() => router.push(SCREEN_PATHS[m.reply!.screen] as never)} />
                  ) : null}
                  <Small muted>{m.reply.label}</Small>
                </View>
              ) : null}
            </View>
          ))}
          {ask.isPending ? <View style={[st.bubble, st.bot]}><Text style={st.bubbleText}>{t("assistant.thinking")}</Text></View> : null}
        </View>
      </ScrollView>
      <View style={st.composer}>
        <View style={[st.inner, { flexDirection: "row", gap: space.sm, alignItems: "flex-end" }]}>
          <Input style={{ flex: 1, minWidth: 0, width: "100%" }} value={draft} onChangeText={setDraft} placeholder={t("assistant.placeholder")} maxLength={500}
            onSubmitEditing={() => send(draft)} returnKeyType="send" accessibilityLabel={t("assistant.placeholder")} />
          <Button icon="send" label={t("assistant.send")} onPress={() => send(draft)} disabled={!draft.trim()} loading={ask.isPending} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  content: { padding: space.lg, alignItems: "center", paddingBottom: space.xxl },
  inner: { width: "100%", maxWidth: MAX_WIDTH, gap: space.md },
  header: { flexDirection: "row", gap: space.md, alignItems: "center", backgroundColor: colors.navy, padding: space.lg, borderRadius: radius.lg },
  title: { color: colors.white, fontSize: 24, fontWeight: "700", fontFamily: fonts.heading },
  subtitle: { color: colors.goldSoft, fontSize: 15 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestion: { minHeight: TOUCH, justifyContent: "center", paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.navy, backgroundColor: colors.surface },
  suggestionText: { color: colors.navy, fontWeight: "700", fontSize: 15 },
  bubble: { padding: space.md, borderRadius: radius.lg, gap: space.sm, maxWidth: "92%" },
  user: { alignSelf: "flex-end", backgroundColor: colors.navy },
  bot: { alignSelf: "flex-start", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bubbleText: { fontSize: 17, lineHeight: 26, color: colors.text },
  composer: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, padding: space.md, alignItems: "center", width: "100%" },
});
