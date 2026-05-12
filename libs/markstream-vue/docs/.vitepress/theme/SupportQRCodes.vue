<script setup lang="ts">
import { withBase } from 'vitepress'

interface Props {
  title: string
  description: string
  note?: string
  alipayLabel?: string
  wechatLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  alipayLabel: 'Alipay',
  wechatLabel: 'WeChat Pay',
})

const alipaySrc = withBase('/sponsor/zhifubao.jpg')
const wechatSrc = withBase('/sponsor/weixin.jpg')
</script>

<template>
  <section class="support-qrs">
    <div class="support-qrs__copy">
      <h2 class="support-qrs__title">
        {{ props.title }}
      </h2>
      <p class="support-qrs__description">
        {{ props.description }}
      </p>
    </div>

    <div class="support-qrs__grid">
      <figure class="support-qrs__card">
        <div class="support-qrs__image-frame">
          <img
            class="support-qrs__image"
            :src="alipaySrc"
            :alt="`${props.alipayLabel} QR code`"
            loading="lazy"
          >
        </div>
        <figcaption class="support-qrs__label">
          {{ props.alipayLabel }}
        </figcaption>
      </figure>

      <figure class="support-qrs__card">
        <div class="support-qrs__image-frame">
          <img
            class="support-qrs__image"
            :src="wechatSrc"
            :alt="`${props.wechatLabel} QR code`"
            loading="lazy"
          >
        </div>
        <figcaption class="support-qrs__label">
          {{ props.wechatLabel }}
        </figcaption>
      </figure>
    </div>

    <p v-if="props.note" class="support-qrs__note">
      {{ props.note }}
    </p>
  </section>
</template>

<style scoped>
.support-qrs {
  margin: 1.5rem 0 2.25rem;
  padding: 1.25rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  background:
    radial-gradient(circle at top left, rgba(61, 120, 255, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(255, 255, 255, 0.98));
}

.support-qrs__copy {
  text-align: center;
}

.support-qrs__title {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.25;
}

.support-qrs__description {
  max-width: 44rem;
  margin: 0.6rem auto 0;
  color: var(--vp-c-text-2);
  line-height: 1.7;
}

.support-qrs__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1.25rem;
}

.support-qrs__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.support-qrs__image-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 320px;
  padding: 0.875rem;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.94), rgba(241, 245, 249, 0.9));
}

.support-qrs__image {
  width: auto;
  max-width: min(100%, 240px);
  max-height: 320px;
  height: auto;
  object-fit: contain;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.12);
}

.support-qrs__label {
  margin-top: 0.85rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.support-qrs__note {
  margin: 1rem auto 0;
  text-align: center;
  color: var(--vp-c-text-2);
  font-size: 0.95rem;
  line-height: 1.7;
}

.dark .support-qrs {
  background:
    radial-gradient(circle at top left, rgba(122, 162, 255, 0.16), transparent 36%),
    linear-gradient(180deg, rgba(16, 24, 40, 0.92), rgba(10, 15, 26, 0.98));
}

.dark .support-qrs__card {
  background: rgba(15, 23, 42, 0.78);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24);
}

.dark .support-qrs__image-frame {
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.82), rgba(15, 23, 42, 0.92));
}

@media (max-width: 640px) {
  .support-qrs {
    padding: 1rem;
    border-radius: 16px;
  }

  .support-qrs__grid {
    grid-template-columns: 1fr;
  }

  .support-qrs__card {
    padding: 0.875rem;
  }

  .support-qrs__image-frame {
    min-height: 260px;
    padding: 0.75rem;
  }

  .support-qrs__image {
    max-height: 260px;
  }
}
</style>
