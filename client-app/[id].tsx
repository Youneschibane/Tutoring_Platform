import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');
const guidelineBaseWidth = 412;
const scale = (size: number) => (width / guidelineBaseWidth) * size;

export default function MailDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [mail, setMail] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // N'oublie pas de mettre TON IP ici aussi !
    const testIP = "172.20.10.2"; 

    // --- 1. RÉCUPÉRATION DU DÉTAIL ---
    const fetchMailDetail = async () => {
        setLoading(true);
        try {
            // Utilisation de la route /detail/:id que nous avons créée dans le back
            const response = await fetch(`http://${testIP}:3000/api/mails/detail/${id}`);
            const data = await response.json();
            setMail(data);
        } catch (error) {
            console.error("Erreur lors de la récupération du mail:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- 2. ACTIONS (RÉPONDRE / TRANSFÉRER) ---
    const handleAction = (type: 'reply' | 'replyAll' | 'forward') => {
        if (!mail) return;

        const newSubject = (type === 'forward' ? 'Fwd: ' : 'Re: ') + (mail.subject || '');
        let finalBody = '';
        
        if (type === 'reply' || type === 'replyAll') {
            const replySpace = "\n\n\n\n";
            finalBody = replySpace + `---------- Message d'origine ----------\nDe: ${mail.sender?.email}\nObjet: ${mail.subject}\n\n${mail.body}`;
        } else if (type === 'forward') {
            finalBody = mail.body || '';
        }

        let recipients = '';
        if (type === 'reply') {
            recipients = mail.sender?.email || '';
        } else if (type === 'replyAll') {
            // On récupère les emails des objets populés
            const toEmails = mail.to?.map((u: any) => u.email) || [];
            const ccEmails = mail.cc?.map((u: any) => u.email) || [];
            const allRecipients = [mail.sender?.email, ...toEmails, ...ccEmails];
            recipients = allRecipients.filter(email => email).join(',');
        }

        router.push({
            pathname: '/(auth)/messagerie/compose',
            params: {
                recipient: recipients,
                subject: newSubject,
                body: finalBody,
                isReply: type === 'forward' ? 'false' : 'true'
            }
        });
    };

    // --- 3. CYCLE DE VIE ---
    useEffect(() => {
        if (id) {
            fetchMailDetail();
            updateStatusToRead();
        }
    }, [id]);

    const updateStatusToRead = async () => {
        try {
            // CORRECTION ICI : Correspondance avec la route PATCH du Backend
            await fetch(`http://${testIP}:3000/api/mails/${id}/read`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isRead: true }) // On informe le back que le mail est lu
            });
            console.log("Statut mis à jour : LU sur le serveur");
        } catch (e) {
            console.error("Erreur mise à jour statut lecture", e);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingCenter}>
                <ActivityIndicator size="large" color="#6C48FF" />
            </View>
        );
    }

    return (
        <View style={styles.mainContainer}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backSquare}>
                    <MaterialIcons name="chevron-left" size={30} color="black" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {mail?.sender?.username || "Détails"}
                </Text>
                <View style={{ width: 45 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* SUJET */}
                <Text style={styles.subjectText}>{mail?.subject || "(Sans objet)"}</Text>

                {/* EXPÉDITEUR */}
                <View style={styles.senderRow}>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarLetter}>
                            {mail?.sender?.username?.charAt(0).toUpperCase() || "?"}
                        </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={styles.nameTimeRow}>
                            <Text style={styles.senderNameText}>{mail?.sender?.username}</Text>
                            <Text style={styles.timeText}>
                                {mail?.sentAt ? new Date(mail.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </Text>
                        </View>
                        <Text style={styles.emailText}>&lt;{mail?.sender?.email}&gt;</Text>
                    </View>
                </View>

                {/* CORPS DU MAIL */}
                <Text style={styles.mailBody}>{mail?.body}</Text>

                {/* ACTIONS */}
                <View style={styles.actionRowTop}>
                    <TouchableOpacity style={styles.actionBtnSmall} onPress={() => handleAction('reply')}>
                        <MaterialCommunityIcons name="reply" size={18} color="black" />
                        <Text style={styles.actionBtnText}>Répondre</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtnSmall} onPress={() => handleAction('replyAll')}>
                        <MaterialCommunityIcons name="reply-all" size={18} color="black" />
                        <Text style={styles.actionBtnText}>Rép. tous</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtnSmall} onPress={() => handleAction('forward')}>
                        <MaterialCommunityIcons name="forward" size={18} color="black" />
                        <Text style={styles.actionBtnText}>Transférer</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#fff' },
    loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5'
    },
    backSquare: {
        width: 45,
        height: 45,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
    scrollContent: { padding: 25 },
    subjectText: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, marginTop: 10 },
    senderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
    avatarCircle: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        backgroundColor: '#C4B5FD',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    avatarLetter: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
    nameTimeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    senderNameText: { fontSize: 16, fontWeight: '700' },
    timeText: { fontSize: 12, color: '#999' },
    emailText: { fontSize: 13, color: '#AAA', marginTop: 2 },
    mailBody: { fontSize: 16, lineHeight: 24, color: '#444', marginBottom: 40 },
    actionRowTop: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 10,
        marginTop: 20,
        marginBottom: 50
    },
    actionBtnSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E0CCFF',
        backgroundColor: '#F9F7FF'
    },
    actionBtnText: { marginLeft: 5, fontSize: 11, fontWeight: '600' },
});