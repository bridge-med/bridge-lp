// Ambient shim so the app typechecks before `react-native-purchases` is
// installed (it's added for production native builds). Once installed, the real
// types from the package are used at build time.
declare module 'react-native-purchases';
