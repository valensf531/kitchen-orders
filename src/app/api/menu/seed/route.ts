import { NextResponse } from 'next/server';
import { menuStore } from '@/lib/menu-store';
import { requireAdmin } from '@/lib/access';
import { revalidatePublicMenu } from '@/lib/menu-cache';

const SEED_MENU = [
  {
    name: 'Entradas',
    order: 0,
    items: [
      { name: 'Mozzarella Sticks', price: 8.50, description: 'Bastones de muzzarella empanados, crocantes, con salsa marinara.', ingredients: 'Muzzarella, pan rallado, huevo, tomate. Contiene gluten, lactosa y huevo.', tags: [] },
      { name: 'Aros de Cebolla', price: 7.00, description: 'Aros de cebolla rebosados con aderezo de hierbas.', ingredients: 'Cebolla, harina de trigo, cerveza. Contiene gluten.', tags: ['vegetariano'] },
      { name: 'Papas Fritas con Cheddar', price: 9.00, description: 'Papas con piel, cheddar fundido y panceta crocante.', ingredients: 'Papas, cheddar, panceta, cebollín. Contiene lactosa.', tags: [] },
      { name: 'Empanadas (x3)', price: 6.50, description: 'Tres empanadas de carne cortada a cuchillo, al horno de barro.', ingredients: 'Carne, cebolla, huevo, aceitunas, masa de trigo. Contiene gluten y huevo.', tags: [] },
      { name: 'Bruschetta', price: 8.00, description: 'Pan tostado con tomate confitado, albahaca y oliva extra virgen.', ingredients: 'Pan de trigo, tomate, albahaca, ajo, aceite de oliva. Contiene gluten.', tags: ['vegetariano'] },
      { name: 'Tabla de Fiambres', price: 12.00, description: 'Selección de fiambres y quesos para compartir.', ingredients: 'Fiambres y quesos variados. Contiene lactosa y sulfitos.', tags: [] },
    ],
  },
  {
    name: 'Ensaladas',
    order: 1,
    items: [
      { name: 'Ensalada César', price: 10.50, description: 'Lechuga romana, pollo grillado, parmesano y croutones.', ingredients: 'Lechuga romana, pollo, parmesano, croutones de trigo, salsa césar. Contiene gluten, lactosa, huevo y anchoas.', tags: [] },
      { name: 'Ensalada Griega', price: 11.00, description: 'Tomate, pepino, aceitunas y queso feta con oliva.', ingredients: 'Tomate, pepino, aceitunas, queso feta, aceite de oliva. Contiene lactosa.', tags: ['vegetariano', 'sin_tacc'] },
      { name: 'Ensalada Caprese', price: 9.50, description: 'Tomate, muzzarella fresca, albahaca y aceite de oliva.', ingredients: 'Tomate, muzzarella, albahaca, aceite de oliva. Contiene lactosa.', tags: ['vegetariano', 'sin_tacc'] },
      { name: 'Ensalada de Rúcula y Parmesano', price: 10.00, description: 'Rúcula fresca, láminas de parmesano y vinagreta de limón.', ingredients: 'Rúcula, parmesano, vinagreta de limón. Contiene lactosa.', tags: ['vegetariano', 'sin_tacc'] },
    ],
  },
  {
    name: 'Pizzas',
    order: 2,
    items: [
      { name: 'Pizza Margherita', price: 12.00, description: 'Salsa de tomate, muzzarella y albahaca fresca.', ingredients: 'Tomate, muzzarella, albahaca, masa de trigo. Contiene gluten y lactosa.', tags: ['vegetariano', 'popular'], featured: true },
      { name: 'Pizza Pepperoni', price: 13.50, description: 'Pepperoni extra y doble muzzarella.', ingredients: 'Tomate, muzzarella, pepperoni, masa de trigo. Contiene gluten, lactosa y cerdo.', tags: [] },
      { name: 'Pizza Napolitana', price: 14.00, description: 'Tomate, muzzarella, ajo asado y perejil.', ingredients: 'Tomate, muzzarella, ajo, perejil, aceitunas, masa de trigo. Contiene gluten y lactosa.', tags: ['vegetariano'] },
      { name: 'Pizza Cuatro Quesos', price: 14.50, description: 'Muzzarella, provolone, roquefort y parmesano.', ingredients: 'Muzzarella, provolone, roquefort, parmesano, masa de trigo. Contiene gluten y lactosa.', tags: ['vegetariano'] },
      { name: 'Pizza Fugazzeta', price: 13.00, description: 'Cebolla caramelizada y muzzarella, estilo porteño.', ingredients: 'Cebolla, muzzarella, masa de trigo. Contiene gluten y lactosa.', tags: ['vegetariano'] },
      { name: 'Pizza Calabra', price: 15.00, description: 'Salame picante, morrón asado y muzzarella.', ingredients: 'Tomate, salame picante, morrón, muzzarella, masa de trigo. Contiene gluten, lactosa y cerdo.', tags: ['picante'] },
    ],
  },
  {
    name: 'Pastas',
    order: 3,
    items: [
      { name: 'Spaghetti Bolognese', price: 11.00, description: 'Spaghetti con salsa de carne clásica, cocinada a fuego lento.', ingredients: 'Spaghetti de trigo, carne vacuna, tomate, zanahoria, apio. Contiene gluten.', tags: [] },
      { name: 'Fettuccine Alfredo', price: 12.00, description: 'Fettuccine cremoso con parmesano y manteca.', ingredients: 'Fettuccine de trigo, crema, parmesano, manteca. Contiene gluten y lactosa.', tags: ['vegetariano'] },
      { name: 'Lasaña de Carne', price: 13.50, description: 'Capas de pasta, carne y bechamel gratinadas.', ingredients: 'Pasta de trigo, carne vacuna, bechamel, queso. Contiene gluten, lactosa y huevo.', tags: ['popular'] },
      { name: 'Ravioles de Ricotta y Espinaca', price: 12.50, description: 'Con salsa fileto o manteca y salvia.', ingredients: 'Pasta de trigo, ricotta, espinaca, parmesano. Contiene gluten, lactosa y huevo.', tags: ['vegetariano'], featured: true },
      { name: 'Ñoquis de Papa', price: 11.50, description: 'Ñoquis caseros con salsa a elección.', ingredients: 'Papa, harina de trigo, huevo. Contiene gluten y huevo.', tags: ['vegetariano'] },
    ],
  },
  {
    name: 'Carnes',
    order: 4,
    items: [
      { name: 'Bife de Chorizo', price: 18.00, description: 'Corte jugoso a la parrilla con guarnición a elección.', ingredients: 'Carne vacuna, sal, pimienta. Guarnición a elección.', tags: ['popular'], featured: true },
      { name: 'Lomo a la Pimienta', price: 20.00, description: 'Lomo en salsa de pimienta verde y cognac.', ingredients: 'Lomo, crema, pimienta verde, cognac. Contiene lactosa y alcohol.', tags: [] },
      { name: 'Pechuga de Pollo a la Plancha', price: 14.00, description: 'Pollo grillado con ensalada de estación.', ingredients: 'Pollo, aceite de oliva, ensalada de estación.', tags: ['sin_tacc'] },
      { name: 'Milanesa de Carne', price: 13.00, description: 'Milanesa crocante con papas fritas.', ingredients: 'Carne vacuna, pan rallado, huevo, papas. Contiene gluten y huevo.', tags: [] },
      { name: 'Milanesa de Pollo', price: 12.50, description: 'Napolitana opcional, con puré o papas.', ingredients: 'Pollo, pan rallado, huevo. Contiene gluten y huevo.', tags: ['popular'] },
    ],
  },
  {
    name: 'Hamburguesas',
    order: 5,
    items: [
      { name: 'Hamburguesa Clásica', price: 11.00, description: 'Carne, cheddar, lechuga, tomate y salsa de la casa.', ingredients: 'Carne vacuna, pan de trigo, cheddar, lechuga, tomate. Contiene gluten y lactosa.', tags: ['popular'] },
      { name: 'Hamburguesa con Queso', price: 12.00, description: 'Doble cheddar fundido y cebolla crispy.', ingredients: 'Carne vacuna, pan de trigo, doble cheddar, cebolla crispy. Contiene gluten y lactosa.', tags: [] },
      { name: 'Hamburguesa BBQ', price: 13.50, description: 'Carne, cheddar, cebolla crispy y BBQ ahumada.', ingredients: 'Carne vacuna, pan de trigo, cheddar, cebolla crispy, salsa BBQ. Contiene gluten y lactosa.', tags: [], featured: true },
      { name: 'Hamburguesa Vegetariana', price: 12.00, description: 'Medallón de lentejas, palta y mayo vegana.', ingredients: 'Lentejas, palta, pan de trigo, mayonesa vegana. Contiene gluten.', tags: ['vegano'] },
    ],
  },
  {
    name: 'Bebidas',
    order: 6,
    items: [
      { name: 'Agua Mineral', price: 3.00, description: 'Botella de agua mineral 500 ml.', ingredients: 'Agua mineral natural.', tags: ['sin_azucar'] },
      { name: 'Agua con Gas', price: 3.00, description: 'Botella de agua con gas 500 ml.', ingredients: 'Agua mineral con gas.', tags: ['sin_azucar'] },
      { name: 'Coca-Cola', price: 3.50, description: 'Lata 354 ml, bien fría.', ingredients: 'Bebida cola azucarada. Contiene cafeína.', tags: ['popular'] },
      { name: 'Sprite', price: 3.50, description: 'Lata 354 ml.', ingredients: 'Bebida sabor lima-limón azucarada.', tags: [] },
      { name: 'Jugo de Naranja Natural', price: 5.00, description: 'Naranjas exprimidas al momento.', ingredients: 'Naranjas exprimidas. Sin azúcar añadido.', tags: ['vegano'] },
      { name: 'Limonada', price: 4.50, description: 'Limón exprimido con jengibre y menta fresca.', ingredients: 'Limón, jengibre, menta, azúcar.', tags: ['vegano'], featured: true },
      { name: 'Cerveza Artesanal', price: 6.00, description: 'IPA o rubia de la casa, 500 ml.', ingredients: 'Cerveza artesanal. Contiene gluten y alcohol.', tags: [] },
      { name: 'Vino de la Casa (Copa)', price: 7.00, description: 'Malbec o Chardonnay, copa servida.', ingredients: 'Vino de la casa. Contiene alcohol y sulfitos.', tags: [] },
    ],
  },
  {
    name: 'Postres',
    order: 7,
    items: [
      { name: 'Flan Casero', price: 6.50, description: 'Flan con dulce de leche y crema.', ingredients: 'Huevo, leche, azúcar, dulce de leche, crema. Contiene lactosa y huevo.', tags: [] },
      { name: 'Tiramisú', price: 7.50, description: 'Clásico italiano con café y mascarpone.', ingredients: 'Mascarpone, café, huevos, bizcocho de trigo, cacao. Contiene gluten, lactosa y huevo.', tags: ['popular'] },
      { name: 'Helado (2 bochas)', price: 5.00, description: 'Sabores de estación a elección.', ingredients: 'Crema, leche, azúcar. Contiene lactosa.', tags: [] },
      { name: 'Brownie con Helado', price: 8.00, description: 'Brownie tibio con helado de crema y dulce de leche.', ingredients: 'Chocolate, manteca, huevos, harina de trigo, helado. Contiene gluten, lactosa y huevo.', tags: [], featured: true },
      { name: 'Cheesecake', price: 7.00, description: 'Cheesecake de frutos rojos.', ingredients: 'Queso crema, azúcar, masa de galleta, frutos rojos. Contiene gluten y lactosa.', tags: [] },
    ],
  },
];

export async function POST() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const userId = admin.restaurantId;

    const existingCategories = await menuStore.getCategories(userId);
    if (existingCategories.length > 0) {
      return NextResponse.json(
        { error: 'El menú ya tiene datos. Borra las categorías existentes primero si quieres regenerarlo.' },
        { status: 409 }
      );
    }

    const created: { categories: string[]; items: number } = { categories: [], items: 0 };

    for (const cat of SEED_MENU) {
      const category = await menuStore.createCategory(userId, cat.name, cat.order);
      created.categories.push(category.name);

      for (const item of cat.items) {
        await menuStore.createItem(userId, {
          name: item.name,
          price: item.price,
          categoryId: category.id,
          description: item.description,
          ingredients: item.ingredients,
          tags: item.tags,
          featured: item.featured ?? false,
        });
        created.items++;
      }
    }

    revalidatePublicMenu(userId);

    return NextResponse.json({
      message: 'Menú creado exitosamente',
      categories: created.categories.length,
      items: created.items,
    });
  } catch (error) {
    console.error('Failed to seed menu:', error);
    return NextResponse.json({ error: 'Error al crear el menú' }, { status: 500 });
  }
}
