importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');
importScripts('/js/config.js'); // Load shared config

if (!self.firebaseConfig) {
    console.error("Firebase Config failing to load in SW");
}

firebase.initializeApp(self.firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/assets/logo-small.png' // Ensure this exists or use a default
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
