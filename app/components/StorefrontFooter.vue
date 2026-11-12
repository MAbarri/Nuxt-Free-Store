<template>
  <footer class="border-t border-stone-200 bg-stone-50">
    <div class="mx-auto max-w-7xl px-4 py-12 text-sm text-stone-600 sm:px-6 lg:px-8">
      <div class="grid gap-8 sm:grid-cols-3">
        <div>
          <p class="font-display text-lg text-stone-900">Atelier</p>
          <p class="mt-2">Thoughtfully made clothing, delivered to your door.</p>
        </div>
        <div>
          <p class="font-medium text-stone-900">Shop</p>
          <ul class="mt-2 space-y-1">
            <li><NuxtLink to="/products">All products</NuxtLink></li>
            <li><NuxtLink to="/categories">Categories</NuxtLink></li>
          </ul>
        </div>
        <div>
          <p class="font-medium text-stone-900">Support</p>
          <ul class="mt-2 space-y-1">
            <li><NuxtLink to="/account/orders">Track an order</NuxtLink></li>
            <li><NuxtLink to="/">Shipping & returns</NuxtLink></li>
          </ul>
        </div>
      </div>
      <p class="mt-10 text-xs text-stone-400">© {{ new Date().getFullYear() }} Atelier. Cash on delivery available.</p>
    </div>
  </footer>
</template>
