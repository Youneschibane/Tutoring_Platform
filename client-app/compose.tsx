import { useAuth } from "@/src/context/AuthContext";
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const testIP = "172.20.10.2"; 
const { width } = Dimensions.get('window');

const ComposeMail = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useAuth() as any;

    // États du formulaire
    const [to, setTo] = useState((params.recipient || "") as string);
    const [subject, setSubject] = useState((params.subject || "") as string);
    const [body, setBody] = useState("");
    const [cc, setCc] = useState('');
    const [bcc, setBcc] = useState('');
    const [attachment, setAttachment] = useState<any>(null);
    
    // États de gestion d'envoi
    const [isSending, setIsSending] = useState(false);
    const [isDelaying, setIsDelaying] = useState(false); 
    const [timer, setTimer] = useState(60);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    // Initialisation du corps du texte (gestion réponse/transfert)
    useEffect(() => {
        if (params.body) {
            const isReply = params.isReply === "true";
            const replySpace = isReply ? "\n\n\n\n\n" : "";
            setBody(replySpace + params.body);
        }
    }, [params.body, params.isReply]);

    // Sélection de fichier
    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
            if (!result.canceled) {
                setAttachment(result.assets[0]);
            }
        } catch (err) {
            Alert.alert("Erreur", "Impossible de sélectionner le fichier");
        }
    };

    // --- ENVOI FINAL AU BACKEND ---
    const executeFinalSend = async () => {
        setIsDelaying(false);
        setIsSending(true);
        try {
            const formData = new FormData();
            formData.append('sender', user._id);
            // On envoie un tableau de strings pour 'to' comme attendu par le back
            formData.append('to', JSON.stringify([to]));
            formData.append('cc', cc ? JSON.stringify([cc]) : JSON.stringify([]));
            formData.append('bcc', bcc ? JSON.stringify([bcc]) : JSON.stringify([]));
            formData.append('subject', subject || "(Sans objet)");
            formData.append('body', body);

            if (attachment) {
                // CORRECTION : Utiliser 'attachments' pour correspondre au upload.array('attachments') du back
                const fileToUpload = {
                    uri: Platform.OS === 'ios' ? attachment.uri.replace('file://', '') : attachment.uri,
                    name: attachment.name,
                    type: attachment.mimeType || 'application/octet-stream',
                };
                // @ts-ignore
                formData.append('attachments', fileToUpload);
            }

            const response = await fetch(`http://${testIP}:3000/api/mails/send`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (response.ok) {
                Alert.alert("Succès", "Message envoyé");
                router.replace('/(auth)/messagerie/recu');
            } else {
                const errorData = await response.json();
                Alert.alert("Erreur", errorData.error || "Erreur serveur");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Erreur", "Problème de connexion au serveur");
        } finally {
            setIsSending(false);
        }
    };

    // --- LOGIQUE DU COMPTE À REBOURS (UNDO) ---
    const startSendProcess = () => {
        if (!to) {
            Alert.alert("Erreur", "Veuillez spécifier au moins un destinataire");
            return;
        }

        setIsDelaying(true);
        setTimer(60);

        // Décompte visuel
        countdownRef.current = setInterval(() => {
            setTimer((prev) => {
                if (prev <= 1) {
                    if (countdownRef.current) clearInterval(countdownRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Déclenchement de l'envoi après 60s
        timerRef.current = setTimeout(() => {
            if (countdownRef.current) clearInterval(countdownRef.current);
            executeFinalSend();
        }, 60000);
    };

    const cancelSend = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        setIsDelaying(false);
        setTimer(60);
        Alert.alert("Annulé", "L'envoi a été interrompu");
    };

    // --- SAUVEGARDE EN BROUILLON FERMETURE ---
    const handleClose = () => {
        if (body.trim().length > 0 || subject.trim().length > 0) {
            const formData = new FormData();
            formData.append('sender', user._id);
            formData.append('to', JSON.stringify([to]));
            formData.append('subject', subject || "(Sans objet)");
            formData.append('body', body);

            fetch(`http://${testIP}:3000/api/mails/draft`, {
                method: 'POST',
                body: formData,
                headers: { 'Accept': 'application/json' },
            }).catch(err => console.log("Erreur draft:", err));

            router.replace('/(auth)/messagerie/recu');
        } else {
            router.back();
        }
    };

    return (
        <View style={styles.Container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleClose} style={styles.iconContainer}>
                    <Ionicons name="close-outline" size={35} color="black" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Nouveau message</Text>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                    <View style={styles.field}>
                        <Text style={styles.label}>À :</Text>
                        <TextInput style={styles.input} value={to} onChangeText={setTo} placeholder="Destinataire..." autoCapitalize="none" />
                    </View>
                    <View style={styles.field}>
                        <Text style={styles.label}>Cc :</Text>
                        <TextInput style={styles.input} value={cc} onChangeText={setCc} placeholder="Copie..." autoCapitalize="none" />
                    </View>
                    <View style={styles.field}>
                        <Text style={styles.label}>Objet :</Text>
                        <TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="Sujet..." />
                    </View>

                    <TextInput
                        style={styles.messageInput}
                        value={body}
                        onChangeText={setBody}
                        multiline
                        textAlignVertical="top"
                        placeholder="Écrivez votre message ici..."
                    />

                    {attachment && (
                        <View style={styles.fileChip}>
                            <MaterialCommunityIcons name="file-document-outline" size={20} color="#9F54F8" />
                            <Text style={styles.fileName} numberOfLines={1}>{attachment.name}</Text>
                            <TouchableOpacity onPress={() => setAttachment(null)}>
                                <Ionicons name="close-circle" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>

                {/* Barre d'annulation Undo */}
                {isDelaying && (
                    <View style={styles.undoContainer}>
                        <Text style={styles.undoText}>Envoi dans {timer}s</Text>
                        <TouchableOpacity onPress={cancelSend}>
                            <Text style={styles.undoBtnLabel}>ANNULER</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.footer}>
                    <TouchableOpacity 
                        style={[styles.sendButton, (isSending || isDelaying) && { backgroundColor: '#CCC' }]} 
                        onPress={startSendProcess}
                        disabled={isSending || isDelaying}
                    >
                        {isSending ? (
                            <ActivityIndicator color="white"/>
                        ) : (
                            <>
                                <MaterialCommunityIcons name="send" size={20} color="white"/>
                                <Text style={styles.sendText}>Envoyer</Text>
                            </>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handlePickDocument} style={styles.attachBtn}>
                        <MaterialCommunityIcons name="paperclip" size={28} color="#666"/>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};

export default ComposeMail;

const styles = StyleSheet.create({
    Container: { flex: 1, backgroundColor: '#FFF' },
    header: { 
        flexDirection: 'row', alignItems: 'center', 
        paddingHorizontal: 15, paddingTop: 60, paddingBottom: 15, 
        borderBottomWidth: 1, borderColor: '#EEE' 
    },
    headerTitle: { fontSize: 20, fontWeight: '700', marginLeft: 12 },
    iconContainer: { width: 40, alignItems: 'center' },
    content: { flex: 1, paddingHorizontal: 20 },
    field: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#EEE', paddingVertical: 10, alignItems: 'center' },
    label: { width: 50, color: '#888', fontSize: 16 },
    input: { flex: 1, fontSize: 16 },
    messageInput: { minHeight: 250, paddingTop: 20, fontSize: 16, textAlignVertical: 'top' },
    fileChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0E6FF', padding: 10, borderRadius: 20, marginTop: 15 },
    fileName: { flex: 1, marginLeft: 10, color: '#333' },
    footer: { 
        flexDirection: 'row', paddingHorizontal: 20, borderTopWidth: 1, borderColor: '#EEE', 
        alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 15, marginBottom: Platform.OS === 'ios' ? 20 : 0 
    },
    sendButton: { flexDirection: 'row', backgroundColor: '#9F54F8', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 30, alignItems: 'center' },
    sendText: { color: 'white', fontWeight: 'bold', marginLeft: 10, fontSize: 16 },
    attachBtn: { marginLeft: 20 },
    undoContainer: { 
        position: 'absolute', bottom: 100, left: 20, right: 20, 
        backgroundColor: '#333', padding: 15, borderRadius: 12, 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 5 
    },
    undoText: { color: 'white', fontSize: 15 },
    undoBtnLabel: { color: '#9F54F8', fontWeight: 'bold', fontSize: 15 },
});