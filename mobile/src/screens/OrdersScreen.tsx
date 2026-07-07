import { useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ClipboardList } from 'lucide-react-native';
import { getOrders, type Order } from '@/lib/orders';

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);

  useFocusEffect(
    useCallback(() => {
      setOrders(getOrders());
    }, [])
  );
  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'placed': return 'Order Placed';
      case 'accepted': return 'Accepted';
      case 'preparing': return 'Preparing';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      default: return 'Pending';
    }
  };

  const getStatusColorStyles = (status: Order['status']) => {
    if (status === 'delivered') {
      return {
        badge: styles.badgeSuccess,
        text: styles.statusSuccess,
      };
    }
    return {
      badge: styles.badgeActive,
      text: styles.statusActive,
    };
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Orders</Text>

      {orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ClipboardList size={48} color="#94A3B8" />
          <Text style={styles.emptyText}>You haven't placed any orders yet.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const stylesConfig = getStatusColorStyles(item.status);
            const dateStr = new Date(item.placedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <View style={styles.orderCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.shopName}>
                    {item.shopEmoji} {item.shopName}
                  </Text>
                  <Text style={styles.dateText}>{dateStr}</Text>
                </View>
                <Text style={styles.amountText}>
                  {item.lines.length} {item.lines.length === 1 ? 'item' : 'items'} · ₹{item.total}
                </Text>
                <View style={styles.footerRow}>
                  <View style={[styles.statusBadge, stylesConfig.badge]}>
                    <Text style={[styles.statusText, stylesConfig.text]}>
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                  <Pressable style={styles.detailsBtn}>
                    <Text style={styles.detailsBtnText}>Track Order</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFCF8',
    paddingTop: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0D1F16',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
  },
  listContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shopName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D1F16',
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  amountText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeSuccess: {
    backgroundColor: '#D1FAE5',
  },
  badgeActive: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusSuccess: {
    color: '#065F46',
  },
  statusActive: {
    color: '#92400E',
  },
  detailsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
});
