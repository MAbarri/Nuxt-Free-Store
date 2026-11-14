<template>
  <div class="flex min-h-screen bg-stone-100">
    <AdminSidebar />
    <AdminMobileNav />
    <div class="min-w-0 flex-1">
      <AdminTopbar />
      <main class="p-4 md:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
