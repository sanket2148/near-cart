import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type HomeTabParamList = {
  Home: undefined;
  Orders: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  HomeTabs: NavigatorScreenParams<HomeTabParamList>;
  ShopDetails: { shopId: string };
  Cart: undefined;
  Login: undefined;
};

export type RootStackNavigationProp<RouteName extends keyof RootStackParamList> = NativeStackNavigationProp<
  RootStackParamList,
  RouteName
>;

export type HomeTabNavigationProp<RouteName extends keyof HomeTabParamList> = CompositeNavigationProp<
  BottomTabNavigationProp<HomeTabParamList, RouteName>,
  NativeStackNavigationProp<RootStackParamList>
>;
