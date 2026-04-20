import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LoginView from '../views/LoginView.vue'
import ChatView from '../views/ChatView.vue'
import ProductsView from '../views/ProductsView.vue'
import OrdersView from '../views/OrdersView.vue'
import AccountView from '../views/AccountView.vue'
import BasketView from '../views/BasketView.vue'
import ProductDetailView from '../views/ProductDetailView.vue'
import OrderDetailView from '../views/OrderDetailView.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/products',
  },
  {
    path: '/login',
    component: LoginView,
    name: 'login',
  },
  {
    path: '/chat',
    component: ChatView,
    name: 'chat',
    meta: { requiresAuth: true, showNav: true },
  },
  {
    path: '/products',
    component: ProductsView,
    name: 'products',
    meta: { requiresAuth: true, showNav: true },
  },
  {
    path: '/products/:id',
    component: ProductDetailView,
    name: 'product_detail',
    meta: {
      requiresAuth: true,
      showNav: true,
      showTopBar: true,
      topBarTitle: 'Mahsulot',
      showTopBarBasket: true,
    },
  },
  {
    path: '/orders',
    component: OrdersView,
    name: 'orders',
    meta: { requiresAuth: true, showNav: true, showTopBar: true, topBarTitle: 'Buyurtmalar' },
  },
  {
    path: '/orders/:id',
    component: OrderDetailView,
    name: 'order_detail',
    meta: { requiresAuth: true, showNav: true, showTopBar: true, topBarTitle: 'Buyurtma' },
  },
  {
    path: '/account',
    component: AccountView,
    name: 'account',
    meta: { requiresAuth: true, showNav: true },
  },
  {
    path: '/basket',
    component: BasketView,
    name: 'basket',
    meta: { requiresAuth: true, showNav: true, showTopBar: true, topBarTitle: 'Savat' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

/**
 * Navigation guard — auth tekshirish
 */
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // App startup da storage dan tokens o'qish
  if (!auth.accessToken && !auth.refreshToken) {
    await auth.loadFromStorage()
  }

  // Agar route auth talab qilsa va token yo'q
  if (to.meta.requiresAuth && !auth.accessToken) {
    return '/login'
  }
})

export default router
