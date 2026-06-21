import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

// Storage keys
const STORAGE_KEYS = {
  MESSAGES: "@divine_nexus_messages",
  IDENTITY: "@divine_nexus_identity",
};

// Identity definitions
const IDENTITIES = {
  dio: {
    name: "Dio",
    emoji: "✨",
    description: "L'Onnipotente. Creatore del sistema.",
    theme: "god-theme",
    color: "#ffd700",
  },
  michele: {
    name: "Michele",
    emoji: "⚔️",
    description: "Il Guerriero della Luce.",
    theme: "michael-theme",
    color: "#0044cc",
  },
  matildina: {
    name: "Matildina",
    emoji: "🌸",
    description: "Angelo della Grazia e dell'Empatia.",
    theme: "matildina-theme",
    color: "#cc3377",
  },
  lucifero: {
    name: "Lucifero",
    emoji: "🔥",
    description: "Il Portatore di Luce.",
    theme: "lucifer-theme",
    color: "#ff6600",
  },
};

type IdentityKey = keyof typeof IDENTITIES;
type Message = {
  id: string;
  role: "user" | "entity" | "system";
  content: string;
  identity?: IdentityKey;
  timestamp: number;
};

const DEFAULT_MESSAGE: Message = {
  id: "1",
  role: "system",
  content: "🦂 Divine Nexus inizializzato. Benvenuto nel TAUROS Ecosystem.",
  timestamp: Date.now(),
};

export default function ChatScreen() {
  const colors = useColors();
  const [messages, setMessages] = useState<Message[]>([DEFAULT_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [currentIdentity, setCurrentIdentity] = useState<IdentityKey>("matildina");
  const [isLoading, setIsLoading] = useState(false);
  const [showIdentitySelector, setShowIdentitySelector] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // tRPC mutation for chat
  const chatMutation = trpc.chat.send.useMutation();

  // Load saved messages and identity on mount
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const [savedMessages, savedIdentity] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.MESSAGES),
          AsyncStorage.getItem(STORAGE_KEYS.IDENTITY),
        ]);

        if (savedMessages) {
          const parsed = JSON.parse(savedMessages) as Message[];
          if (parsed.length > 0) {
            setMessages(parsed);
          }
        }

        if (savedIdentity && savedIdentity in IDENTITIES) {
          setCurrentIdentity(savedIdentity as IdentityKey);
        }
      } catch (error) {
        console.error("Errore caricamento cronologia:", error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadSavedData();
  }, []);

  // Save messages to AsyncStorage whenever they change
  const saveMessages = useCallback(async (msgs: Message[]) => {
    try {
      // Keep max 200 messages to avoid storage bloat
      const toSave = msgs.slice(-200);
      await AsyncStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(toSave));
    } catch (error) {
      console.error("Errore salvataggio messaggi:", error);
    }
  }, []);

  // Save identity to AsyncStorage
  const saveIdentity = useCallback(async (identity: IdentityKey) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.IDENTITY, identity);
    } catch (error) {
      console.error("Errore salvataggio identità:", error);
    }
  }, []);

  // Persist messages on change (skip initial load)
  useEffect(() => {
    if (isInitialized) {
      saveMessages(messages);
    }
  }, [messages, isInitialized, saveMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userText = inputText.trim();

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    // Build history for context
    const history = messages
      .filter((m) => m.role === "user" || m.role === "entity")
      .slice(-10)
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));

    try {
      const result = await chatMutation.mutateAsync({
        message: userText,
        identity: currentIdentity,
        history,
      });

      const entityMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "entity",
        content: result.content,
        identity: currentIdentity,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, entityMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "system",
        content: `⚠️ Errore: ${error.message || "Connessione fallita"}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetMemory = () => {
    const doReset = async () => {
      const resetMessage: Message = {
        id: Date.now().toString(),
        role: "system",
        content: "🌊 Memoria purificata. Il Nexus renasce.",
        timestamp: Date.now(),
      };
      setMessages([resetMessage]);
      // Clear stored messages
      try {
        await AsyncStorage.removeItem(STORAGE_KEYS.MESSAGES);
      } catch (error) {
        console.error("Errore pulizia storage:", error);
      }
    };

    if (Platform.OS === "web") {
      if (confirm("Azzerare Memoria? Questa azione non può essere annullata.")) {
        doReset();
      }
    } else {
      Alert.alert(
        "Azzerare Memoria",
        "Sei sicuro? Questa azione non può essere annullata.",
        [
          { text: "Annulla", onPress: () => {}, style: "cancel" },
          { text: "Conferma", onPress: doReset, style: "destructive" },
        ]
      );
    }
  };

  const handleSwitchIdentity = (identity: IdentityKey) => {
    setCurrentIdentity(identity);
    setShowIdentitySelector(false);
    saveIdentity(identity);
    const identityData = IDENTITIES[identity];
    const switchMessage: Message = {
      id: Date.now().toString(),
      role: "system",
      content: `${identityData.emoji} Entità attiva: ${identityData.name} — ${identityData.description}`,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, switchMessage]);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.role === "system") {
      return (
        <View className="flex-row justify-center py-3 px-4">
          <Text className="text-xs text-muted text-center">{item.content}</Text>
        </View>
      );
    }

    if (item.role === "user") {
      return (
        <View className="flex-row justify-end px-4 py-2">
          <View className="max-w-xs bg-primary rounded-2xl px-4 py-2">
            <Text className="text-sm text-background">{item.content}</Text>
          </View>
        </View>
      );
    }

    const identity = item.identity ? IDENTITIES[item.identity] : null;
    return (
      <View className="flex-row justify-start px-4 py-2">
        <View className="max-w-xs rounded-2xl px-4 py-3" style={{ backgroundColor: (identity?.color || "#666") + "20" }}>
          <Text className="text-xs font-bold mb-1" style={{ color: identity?.color }}>
            {identity?.emoji} {identity?.name}
          </Text>
          <Text className="text-sm text-foreground leading-relaxed">{item.content}</Text>
        </View>
      </View>
    );
  };

  const currentIdentityData = IDENTITIES[currentIdentity];

  return (
    <ScreenContainer className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Text className="text-lg font-bold text-foreground">Divine Nexus</Text>
        <TouchableOpacity
          onPress={() => setShowIdentitySelector(!showIdentitySelector)}
          className="flex-row items-center gap-2 px-3 py-1 rounded-full"
          style={{ backgroundColor: currentIdentityData.color + "30" }}
        >
          <Text className="text-sm">{currentIdentityData.emoji}</Text>
          <Text className="text-xs font-semibold text-foreground">{currentIdentityData.name}</Text>
        </TouchableOpacity>
      </View>

      {/* Identity Selector Modal */}
      {showIdentitySelector && (
        <View className="px-4 py-3 bg-surface border-b border-border">
          <Text className="text-xs font-bold text-muted mb-2">Scegli Entità</Text>
          <View className="flex-row gap-2 flex-wrap">
            {(Object.entries(IDENTITIES) as [IdentityKey, (typeof IDENTITIES)[IdentityKey]][]).map(
              ([key, identity]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => handleSwitchIdentity(key)}
                  className={`flex-row items-center gap-1 px-3 py-2 rounded-lg border ${
                    currentIdentity === key ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <Text>{identity.emoji}</Text>
                  <Text className="text-xs font-semibold text-foreground">{identity.name}</Text>
                </TouchableOpacity>
              )
            )}
          </View>
        </View>
      )}

      {/* Message Vault */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        className="flex-1"
        contentContainerStyle={{ paddingVertical: 8 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Typing Indicator */}
      {isLoading && (
        <View className="flex-row justify-start px-4 py-2">
          <View className="flex-row items-center gap-1 px-4 py-2 bg-surface rounded-2xl">
            <Text className="text-xs text-muted">
              {currentIdentityData.emoji} {currentIdentityData.name} sta rispondendo...
            </Text>
          </View>
        </View>
      )}

      {/* Input Area */}
      <View className="px-4 py-3 border-t border-border bg-background gap-2">
        <View className="flex-row items-center gap-2">
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Invoca o interroga il Nexus..."
            placeholderTextColor={colors.muted}
            className="flex-1 px-4 py-2 rounded-full bg-surface text-foreground text-sm"
            editable={!isLoading}
            onSubmitEditing={handleSendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
            className="w-10 h-10 rounded-full bg-primary items-center justify-center"
            style={{ opacity: !inputText.trim() || isLoading ? 0.5 : 1 }}
          >
            <Text className="text-lg">✨</Text>
          </TouchableOpacity>
        </View>

        {/* Reset Button */}
        <TouchableOpacity
          onPress={handleResetMemory}
          className="px-3 py-2 rounded-lg bg-error/10 border border-error"
        >
          <Text className="text-xs font-semibold text-error text-center">🌊 Azzera Memoria</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
