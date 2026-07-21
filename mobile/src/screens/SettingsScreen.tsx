import { StyleSheet, Text, View, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { User, Shield, CreditCard, LogOut, ChevronRight, LogIn } from 'lucide-react-native';
import { useAuth } from '../lib/auth';
import { RootStackNavigationProp } from '../navigation/types';

export default function SettingsScreen() {
  const navigation = useNavigation<RootStackNavigationProp<'HomeTabs'>>();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out of NearCart?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: () => { logout(); } }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Profile Section */}
      {user ? (
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.email.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.profileName}>{user.email}</Text>
            <Text style={styles.profileEmail}>NearCart customer</Text>
          </View>
        </View>
      ) : (
        <Pressable style={styles.profileCard} onPress={() => navigation.navigate('Login')}>
          <View style={styles.avatar}>
            <LogIn size={18} color="#FFFFFF" />
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.profileName}>Log in</Text>
            <Text style={styles.profileEmail}>Tap to log in with your email</Text>
          </View>
          <ChevronRight size={16} color="#94A3B8" />
        </Pressable>
      )}

      {/* Menu Settings */}
      <View style={styles.menuList}>
        <Pressable style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <User size={18} color="#475569" />
            <Text style={styles.menuLabel}>Edit Profile</Text>
          </View>
          <ChevronRight size={16} color="#94A3B8" />
        </Pressable>

        <Pressable style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <CreditCard size={18} color="#475569" />
            <Text style={styles.menuLabel}>Payment Methods</Text>
          </View>
          <ChevronRight size={16} color="#94A3B8" />
        </Pressable>

        <Pressable style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <Shield size={18} color="#475569" />
            <Text style={styles.menuLabel}>Verification Info</Text>
          </View>
          <ChevronRight size={16} color="#94A3B8" />
        </Pressable>

        {user && (
          <Pressable onPress={handleLogout} style={[styles.menuItem, styles.logoutItem]}>
            <View style={styles.menuLeft}>
              <LogOut size={18} color="#EF4444" />
              <Text style={[styles.menuLabel, styles.logoutLabel]}>Log Out</Text>
            </View>
            <ChevronRight size={16} color="#EF4444" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFCF8',
    paddingTop: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    marginHorizontal: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#259F56',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D1F16',
  },
  profileEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  menuList: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  logoutLabel: {
    color: '#EF4444',
  },
});
