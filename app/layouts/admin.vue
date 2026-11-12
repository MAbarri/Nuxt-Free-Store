<template>
  <div class="flex min-h-screen bg-stone-100">
    <AdminSidebar />
    <div class="flex-1">
      <AdminTopbar />
      <main class="p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
