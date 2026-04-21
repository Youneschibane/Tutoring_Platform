import { useAuth } from "@/src/context/AuthContext";
import { COLORS } from '@/src/styles/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Image, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert } from "react-native";

const { width } = Dimensions.get('window');
const guidelineBaseWidth = 412;
const scale = (size: number) => (width / guidelineBaseWidth) * size;

interface Message {
    _id: string;
    sender: { username: string; email: string; profilePic?: string };
    subject: string;
    body: string;
    sentAt: string;
    isRead: boolean;
    status: string;
    avatarColor?: string;
    attachments?: any[];
}

export default function ReçuScreen() {
    const router = useRouter();
    const { user } = useAuth() as any;
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('Reçus'); // 'Reçus', 'Envoyés', 'Brouillons', 'Corbeille'
    
    const testIP = "172.20.10.2"; 

    // --- CHARGEMENT DES MESSAGES ---
    const loadMessages = async () => {
        if (!user?._id) return;
        try {
            setLoading(true);
            
            // On détermine quel endpoint appeler selon l'onglet
            let endpoint = 'inbox';
            if (activeTab === 'Envoyés') endpoint = 'sent';
            if (activeTab === 'Brouillons') endpoint = 'drafts';
            if (activeTab === 'Corbeille') endpoint = 'trash';

            const response = await fetch(`http://${testIP}:3000/api/mails/${endpoint}/${user._id}`);
            const data = await response.json();
            
            if (Array.isArray(data)) {
                setMessages(data);
            }
        } catch (error) {
            console.error("Erreur de récupération:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadMessages();
        }, [user?._id, activeTab]) // Recharge si on change d'onglet ou d'utilisateur
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadMessages();
    };

    // --- ACTIONS SUR LES MESSAGES ---
    const toggleSelection = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleDelete = async () => {
        if (selectedIds.length === 0) return;

        const idsToDelete = [...selectedIds];
        setSelectedIds([]);

        try {
            // Optimisme : on retire de la vue immédiatement
            setMessages(prev => prev.filter(msg => !idsToDelete.includes(msg._id)));

            const promises = idsToDelete.map(id =>
                fetch(`http://${testIP}:3000/api/mails/${id}`, { 
                    method: 'PATCH', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'trash' })
                })
            );
            await Promise.all(promises);
            Alert.alert("Succès", `${idsToDelete.length} message(s) déplacé(s) vers la corbeille.`);
        } catch (error) {
            console.error("Erreur suppression:", error);
            loadMessages(); // Recharger en cas d'échec
        }
    };

    const handleToggleRead = async () => {
        const newReadStatus = hasUnread; // Si un message est non lu, on marque tout comme lu
        const idsToUpdate = [...selectedIds];
        setSelectedIds([]);

        try {
            setMessages(prev => prev.map(msg => 
                idsToUpdate.includes(msg._id) ? { ...msg, isRead: newReadStatus } : msg
            ));

            const promises = idsToUpdate.map(id =>
                fetch(`http://${testIP}:3000/api/mails/${id}/read`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isRead: newReadStatus })
                })
            );
            await Promise.all(promises);
        } catch (error) {
            console.error("Erreur status lecture:", error);
        }
    };

    // --- RENDU D'UN ITEM ---
    const renderMessage = ({ item }: { item: Message }) => {
        const senderName = activeTab === 'Envoyés' || activeTab === 'Brouillons' 
            ? (item.sender?.username || "Moi") 
            : (item.sender?.username || "Inconnu");
            
        const initial = senderName.charAt(0).toUpperCase();

        return (
            <TouchableOpacity 
                style={[
                    styles.messageItem,
                    { backgroundColor: selectedIds.includes(item._id) ? '#F3E8FF' : '#FFFFFF' }
                ]}
                onPress={() => {
                    if (activeTab === 'Brouillons') {
                        router.push({
                            pathname: '/(auth)/messagerie/compose',
                            params: { 
                                id: item._id, 
                                recipient: item.sender?.email, // Dans un draft, l'email est souvent stocké ici
                                subject: item.subject, 
                                body: item.body 
                            }
                        });
                    } else {
                        // Marquer comme lu localement pour l'UI
                        if (!item.isRead) {
                            fetch(`http://${testIP}:3000/api/mails/${item._id}/read`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ isRead: true })
                            });
                        }
                        router.push({
                            pathname: "/(auth)/messagerie/[id]", 
                            params: { id: item._id }
                        });
                    }
                }}
            >
                <View style={[styles.avatar, { backgroundColor: item.avatarColor || COLORS.primary }]}>
                    <Text style={styles.avatarText}>{initial}</Text>
                </View>

                <View style={styles.messageBody}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.sender, { fontWeight: !item.isRead ? '700' : '500' }]}>
                            {senderName}
                        </Text>
                        {item.attachments && item.attachments.length > 0 && (
                            <MaterialIcons name="attach-file" size={14} color="#999" style={{ marginLeft: 6 }} />
                        )}
                    </View>
                    <Text style={[styles.subject, { fontWeight: !item.isRead ? '600' : '400' }]} numberOfLines={1}>
                        {item.subject || "(Sans objet)"}
                    </Text>
                </View>

                <View style={styles.rightSection}>
                    <Text style={styles.time}>
                        {item.sentAt ? new Date(item.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                    <View style={styles.actionRow}>
                        <TouchableOpacity onPress={() => {
                            const newSet = new Set(starredIds);
                            newSet.has(item._id) ? newSet.delete(item._id) : newSet.add(item._id);
                            setStarredIds(newSet);
                        }}>
                            <Text style={[styles.starEmoji, { color: starredIds.has(item._id) ? '#FFD700' : '#CCC' }]}>
                                {starredIds.has(item._id) ? '★' : '☆'} 
                            </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={[styles.box, { backgroundColor: selectedIds.includes(item._id) ? COLORS.primary : 'transparent', borderColor: selectedIds.includes(item._id) ? COLORS.primary : '#CCC' }]}
                            onPress={() => toggleSelection(item._id)}
                        >
                            {selectedIds.includes(item._id) && (
                                <Image source={require('../../../assets/icons/check.png')} style={{ width: 10, height: 10, tintColor: '#FFFFFF' }} />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const hasUnread = messages.filter(msg => selectedIds.includes(msg._id)).some(msg => !msg.isRead);
    const actionLabel = hasUnread ? "Marquer comme lu" : "Marquer comme non lu";
    const unreadCount = messages.filter(msg => msg.status === 'inbox' && !msg.isRead).length;

    // Filtrage recherche
    const filteredMessages = messages.filter(msg => {
        const term = searchQuery.toLowerCase();
        return (
            msg.sender?.username?.toLowerCase().includes(term) ||
            msg.subject?.toLowerCase().includes(term) ||
            msg.body?.toLowerCase().includes(term)
        );
    });

    return (
        <View style={styles.container}>
            <View style={styles.headerSection}>
                <Text style={styles.title}>Messagerie</Text>
            </View> 

            <View style={styles.tabsContainer}>
                {['Reçus', 'Envoyés', 'Brouillons', 'Corbeille'].map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        style={[styles.tabBtn, activeTab === tab && styles.activeTabBorder]}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[styles.tabLabel, activeTab === tab && styles.activeTabLabel]}>{tab}</Text>
                            {tab === 'Reçus' && unreadCount > 0 && (
                                <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>
                            )}
                        </View> 
                    </TouchableOpacity>
                ))}
            </View>
            
            <View style={styles.searchContainer}>
                <Image source={require('../../../assets/icons/search.png')} style={styles.searchIcon} />
                <TextInput 
                    placeholder="Recherche..." 
                    style={styles.searchInput} 
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {loading && !refreshing ? (
                <ActivityIndicator size="large" color="#9F54F8" style={{ marginTop: 50 }} />
            ) : (
                <>
                    <FlatList 
                        data={filteredMessages}
                        keyExtractor={(item) => item._id}
                        renderItem={renderMessage}
                        ListEmptyComponent={() => (
                            <View style={styles.emptyStateContainer}>
                                <Image 
                                    source={activeTab === 'Corbeille' ? require('../../../assets/icons/trash.png') : require('../../../assets/icons/edit.png')} 
                                    style={styles.emptyStateIcon} 
                                />
                                <Text style={styles.emptyStateTitle}>Aucun message</Text>
                                <Text style={styles.emptyStateSubtitle}>Cette catégorie est vide.</Text>
                            </View>
                        )}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#9F54F8']} />}
                    />
                    
                    {selectedIds.length > 0 && (
                        <View style={styles.actionBarContainer}>
                            <View style={styles.actionBar}>
                                <TouchableOpacity style={styles.actionButton} onPress={handleToggleRead}>
                                    <Image source={require('../../../assets/icons/enveloppe.png')} style={styles.actionIcon} />
                                    <Text style={styles.actionText}>{actionLabel}</Text>
                                </TouchableOpacity>
                                {activeTab !== 'Corbeille' && (
                                    <>
                                        <View style={styles.actionDivider} />
                                        <TouchableOpacity style={styles.actionButton} onPress={handleDelete}>
                                            <Image source={require('../../../assets/icons/trash.png')} style={styles.actionIcon} />
                                            <Text style={styles.actionText}>Supprimer</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </View>
                    )}
                    
                    <TouchableOpacity style={styles.composeButton} onPress={() => router.push('/(auth)/messagerie/compose')}>
                        <Image source={require('../../../assets/icons/edit.png')} style={styles.composeIcon} />
                        <Text style={styles.composeText}>Compose</Text>
                    </TouchableOpacity>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: scale(20) },
    headerSection: { marginTop: 60, marginBottom: 15 },
    title: { fontSize: 24, fontWeight: '700', marginTop: 10 },
    tabsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    tabBtn: { paddingBottom: 8 },
    activeTabBorder: { borderBottomWidth: 3, borderBottomColor: '#9F54F8' },
    tabLabel: { fontSize: scale(13), color: '#888' },
    activeTabLabel: { color: '#9F54F8', fontWeight: 'bold' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3E8FF', borderRadius: 14, paddingHorizontal: 15, height: scale(45), marginBottom: 20 },
    searchIcon: { width: 16, height: 16, tintColor: '#999', marginRight: 10 },
    searchInput: { flex: 1, fontSize: scale(14), color: '#000' },
    messageItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', marginHorizontal: -20, paddingHorizontal: 20 },
    avatar: { width: scale(45), height: scale(45), borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: scale(18) },
    messageBody: { flex: 1 },
    sender: { fontSize: scale(15), color: '#1A1A1A' },
    subject: { fontSize: scale(13), color: '#666', marginTop: 2 },
    rightSection: { alignItems: 'flex-end', justifyContent: 'space-between', height: scale(55) },
    time: { fontSize: scale(11), color: '#999' },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    starEmoji: { fontSize: scale(22), marginTop: 2 },
    box: { width: scale(18), height: scale(18), borderWidth: 1.5, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
    badge: { backgroundColor: 'red', borderRadius: 10, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', marginLeft: 5, paddingHorizontal: 4 },
    badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
    composeButton: { position: 'absolute', bottom: 40, right: 20, backgroundColor: '#9F54F8', flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 30, elevation: 5 },
    composeIcon: { width: 18, height: 18, tintColor: '#FFF', marginRight: 10 },
    composeText: { color: '#FFF', fontWeight: 'bold', fontSize: scale(14) },
    actionBarContainer: { position: 'absolute', bottom: 120, left: 20, right: 20, zIndex: 10 },
    actionBar: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 15, paddingVertical: 15, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, borderWidth: 1, borderColor: '#F0F0F0' },
    actionButton: { flex: 1, alignItems: 'center' },
    actionIcon: { width: 22, height: 22, tintColor: '#A0A0A0', marginBottom: 5 },
    actionText: { fontSize: scale(10), color: '#A0A0A0' },
    actionDivider: { width: 1, height: '70%', backgroundColor: '#EEE', alignSelf: 'center' },
    emptyStateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: scale(80) },
    emptyStateIcon: { width: scale(60), height: scale(60), tintColor: '#CCC', marginBottom: 15 },
    emptyStateTitle: { fontSize: scale(16), fontWeight: '700', color: '#888' },
    emptyStateSubtitle: { fontSize: scale(13), color: '#AAA', textAlign: 'center' }
});