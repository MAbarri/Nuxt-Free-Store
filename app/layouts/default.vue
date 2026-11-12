<template>
  <div class="flex min-h-screen flex-col">
    <StorefrontHeader />
    <main class="flex-1">
      <slot />
    </main>
    <StorefrontFooter />
  </div>
</template>
