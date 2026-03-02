import { Tabs } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import {
  LayoutDashboard,
  Upload,
  Table,
  ClipboardCheck,
  BarChart3,
  Box,
  Download
} from 'lucide-react-native';

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500' as const,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Anasayfa',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Yükle',
          tabBarIcon: ({ color, size }) => (
            <Upload size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="data-viewer"
        options={{
          title: 'Veriler',
          tabBarIcon: ({ color, size }) => (
            <Table size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="validation"
        options={{
          title: 'Doğrulama',
          tabBarIcon: ({ color, size }) => (
            <ClipboardCheck size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="charts"
        options={{
          title: 'Grafikler',
          tabBarIcon: ({ color, size }) => (
            <BarChart3 size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="viewer3d"
        options={{
          title: '3D',
          tabBarIcon: ({ color, size }) => (
            <Box size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="export"
        options={{
          title: 'Export',
          tabBarIcon: ({ color, size }) => (
            <Download size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
