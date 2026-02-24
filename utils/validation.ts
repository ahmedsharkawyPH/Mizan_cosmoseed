import { z } from 'zod';

export const cartItemSchema = z.object({
  product: z.object({
    id: z.string().min(1, "معرف المنتج مطلوب"),
    name: z.string().min(1, "اسم المنتج مطلوب"),
  }),
  quantity: z.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  unit_price: z.number().nonnegative("السعر لا يمكن أن يكون سالباً"),
  discount_percentage: z.number().min(0).max(100).default(0),
});

export const saleInvoiceSchema = z.object({
  customerId: z.string().min(1, "يرجى اختيار عميل"),
  items: z.array(cartItemSchema).min(1, "يجب إضافة صنف واحد على الأقل"),
  cashPayment: z.number().nonnegative("المبلغ المسدد لا يمكن أن يكون سالباً"),
});

export const purchaseItemSchema = z.object({
  product_id: z.string().min(1, "معرف المنتج مطلوب"),
  warehouse_id: z.string().min(1, "يرجى اختيار مخزن"),
  quantity: z.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  cost_price: z.number().nonnegative("سعر التكلفة لا يمكن أن يكون سالباً"),
  selling_price: z.number().nonnegative("سعر البيع لا يمكن أن يكون سالباً"),
});

export const purchaseInvoiceSchema = z.object({
  supplierId: z.string().min(1, "يرجى اختيار مورد"),
  items: z.array(purchaseItemSchema).min(1, "يجب إضافة صنف واحد على الأقل"),
  cashPaid: z.number().nonnegative("المبلغ المسدد لا يمكن أن يكون سالباً"),
});

export const productSchema = z.object({
  name: z.string().min(1, "اسم المنتج مطلوب"),
  code: z.string().optional(),
  selling_price: z.number().nonnegative("سعر البيع لا يمكن أن يكون سالباً").optional(),
  purchase_price: z.number().nonnegative("سعر الشراء لا يمكن أن يكون سالباً").optional(),
});

export const customerSchema = z.object({
  name: z.string().min(1, "اسم العميل مطلوب"),
  phone: z.string().min(1, "رقم الهاتف مطلوب"),
});

export const supplierSchema = z.object({
  name: z.string().min(1, "اسم المورد مطلوب"),
  phone: z.string().min(1, "رقم الهاتف مطلوب"),
});
