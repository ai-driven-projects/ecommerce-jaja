// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'cart_entity.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$CartItem {

 String get productId; int get quantity;
/// Create a copy of CartItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CartItemCopyWith<CartItem> get copyWith => _$CartItemCopyWithImpl<CartItem>(this as CartItem, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CartItem&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.quantity, quantity) || other.quantity == quantity));
}


@override
int get hashCode => Object.hash(runtimeType,productId,quantity);

@override
String toString() {
  return 'CartItem(productId: $productId, quantity: $quantity)';
}


}

/// @nodoc
abstract mixin class $CartItemCopyWith<$Res>  {
  factory $CartItemCopyWith(CartItem value, $Res Function(CartItem) _then) = _$CartItemCopyWithImpl;
@useResult
$Res call({
 String productId, int quantity
});




}
/// @nodoc
class _$CartItemCopyWithImpl<$Res>
    implements $CartItemCopyWith<$Res> {
  _$CartItemCopyWithImpl(this._self, this._then);

  final CartItem _self;
  final $Res Function(CartItem) _then;

/// Create a copy of CartItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? productId = null,Object? quantity = null,}) {
  return _then(CartItem(
productId: null == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [CartItem].
extension CartItemPatterns on CartItem {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CartItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CartItem() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CartItem value)  $default,){
final _that = this;
switch (_that) {
case _CartItem():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CartItem value)?  $default,){
final _that = this;
switch (_that) {
case _CartItem() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String productId,  int quantity)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CartItem() when $default != null:
return $default(_that.productId,_that.quantity);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String productId,  int quantity)  $default,) {final _that = this;
switch (_that) {
case _CartItem():
return $default(_that.productId,_that.quantity);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String productId,  int quantity)?  $default,) {final _that = this;
switch (_that) {
case _CartItem() when $default != null:
return $default(_that.productId,_that.quantity);case _:
  return null;

}
}

}

/// @nodoc


class _CartItem implements CartItem {
  const _CartItem({required this.productId, required this.quantity});
  

@override final  String productId;
@override final  int quantity;

/// Create a copy of CartItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CartItemCopyWith<_CartItem> get copyWith => __$CartItemCopyWithImpl<_CartItem>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CartItem&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.quantity, quantity) || other.quantity == quantity));
}


@override
int get hashCode => Object.hash(runtimeType,productId,quantity);

@override
String toString() {
  return 'CartItem(productId: $productId, quantity: $quantity)';
}


}

/// @nodoc
abstract mixin class _$CartItemCopyWith<$Res> implements $CartItemCopyWith<$Res> {
  factory _$CartItemCopyWith(_CartItem value, $Res Function(_CartItem) _then) = __$CartItemCopyWithImpl;
@override @useResult
$Res call({
 String productId, int quantity
});




}
/// @nodoc
class __$CartItemCopyWithImpl<$Res>
    implements _$CartItemCopyWith<$Res> {
  __$CartItemCopyWithImpl(this._self, this._then);

  final _CartItem _self;
  final $Res Function(_CartItem) _then;

/// Create a copy of CartItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? productId = null,Object? quantity = null,}) {
  return _then(_CartItem(
productId: null == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

/// @nodoc
mixin _$CartLine {

 String get productId; String get slug; String get name; String get unit; String get rootCategorySlug; String? get thumbUrl; Money get price; Money? get listPrice; int get quantity; bool get isAvailable; Money? get lineTotal;
/// Create a copy of CartLine
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CartLineCopyWith<CartLine> get copyWith => _$CartLineCopyWithImpl<CartLine>(this as CartLine, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CartLine&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.name, name) || other.name == name)&&(identical(other.unit, unit) || other.unit == unit)&&(identical(other.rootCategorySlug, rootCategorySlug) || other.rootCategorySlug == rootCategorySlug)&&(identical(other.thumbUrl, thumbUrl) || other.thumbUrl == thumbUrl)&&(identical(other.price, price) || other.price == price)&&(identical(other.listPrice, listPrice) || other.listPrice == listPrice)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.isAvailable, isAvailable) || other.isAvailable == isAvailable)&&(identical(other.lineTotal, lineTotal) || other.lineTotal == lineTotal));
}


@override
int get hashCode => Object.hash(runtimeType,productId,slug,name,unit,rootCategorySlug,thumbUrl,price,listPrice,quantity,isAvailable,lineTotal);

@override
String toString() {
  return 'CartLine(productId: $productId, slug: $slug, name: $name, unit: $unit, rootCategorySlug: $rootCategorySlug, thumbUrl: $thumbUrl, price: $price, listPrice: $listPrice, quantity: $quantity, isAvailable: $isAvailable, lineTotal: $lineTotal)';
}


}

/// @nodoc
abstract mixin class $CartLineCopyWith<$Res>  {
  factory $CartLineCopyWith(CartLine value, $Res Function(CartLine) _then) = _$CartLineCopyWithImpl;
@useResult
$Res call({
 String productId, String slug, String name, String unit, String rootCategorySlug, String? thumbUrl, Money price, Money? listPrice, int quantity, bool isAvailable, Money? lineTotal
});




}
/// @nodoc
class _$CartLineCopyWithImpl<$Res>
    implements $CartLineCopyWith<$Res> {
  _$CartLineCopyWithImpl(this._self, this._then);

  final CartLine _self;
  final $Res Function(CartLine) _then;

/// Create a copy of CartLine
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? productId = null,Object? slug = null,Object? name = null,Object? unit = null,Object? rootCategorySlug = null,Object? thumbUrl = freezed,Object? price = null,Object? listPrice = freezed,Object? quantity = null,Object? isAvailable = null,Object? lineTotal = freezed,}) {
  return _then(CartLine(
productId: null == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,unit: null == unit ? _self.unit : unit // ignore: cast_nullable_to_non_nullable
as String,rootCategorySlug: null == rootCategorySlug ? _self.rootCategorySlug : rootCategorySlug // ignore: cast_nullable_to_non_nullable
as String,thumbUrl: freezed == thumbUrl ? _self.thumbUrl : thumbUrl // ignore: cast_nullable_to_non_nullable
as String?,price: null == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as Money,listPrice: freezed == listPrice ? _self.listPrice : listPrice // ignore: cast_nullable_to_non_nullable
as Money?,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as int,isAvailable: null == isAvailable ? _self.isAvailable : isAvailable // ignore: cast_nullable_to_non_nullable
as bool,lineTotal: freezed == lineTotal ? _self.lineTotal : lineTotal // ignore: cast_nullable_to_non_nullable
as Money?,
  ));
}

}


/// Adds pattern-matching-related methods to [CartLine].
extension CartLinePatterns on CartLine {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CartLine value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CartLine() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CartLine value)  $default,){
final _that = this;
switch (_that) {
case _CartLine():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CartLine value)?  $default,){
final _that = this;
switch (_that) {
case _CartLine() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String productId,  String slug,  String name,  String unit,  String rootCategorySlug,  String? thumbUrl,  Money price,  Money? listPrice,  int quantity,  bool isAvailable,  Money? lineTotal)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CartLine() when $default != null:
return $default(_that.productId,_that.slug,_that.name,_that.unit,_that.rootCategorySlug,_that.thumbUrl,_that.price,_that.listPrice,_that.quantity,_that.isAvailable,_that.lineTotal);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String productId,  String slug,  String name,  String unit,  String rootCategorySlug,  String? thumbUrl,  Money price,  Money? listPrice,  int quantity,  bool isAvailable,  Money? lineTotal)  $default,) {final _that = this;
switch (_that) {
case _CartLine():
return $default(_that.productId,_that.slug,_that.name,_that.unit,_that.rootCategorySlug,_that.thumbUrl,_that.price,_that.listPrice,_that.quantity,_that.isAvailable,_that.lineTotal);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String productId,  String slug,  String name,  String unit,  String rootCategorySlug,  String? thumbUrl,  Money price,  Money? listPrice,  int quantity,  bool isAvailable,  Money? lineTotal)?  $default,) {final _that = this;
switch (_that) {
case _CartLine() when $default != null:
return $default(_that.productId,_that.slug,_that.name,_that.unit,_that.rootCategorySlug,_that.thumbUrl,_that.price,_that.listPrice,_that.quantity,_that.isAvailable,_that.lineTotal);case _:
  return null;

}
}

}

/// @nodoc


class _CartLine implements CartLine {
  const _CartLine({required this.productId, required this.slug, required this.name, required this.unit, required this.rootCategorySlug, required this.thumbUrl, required this.price, required this.listPrice, required this.quantity, required this.isAvailable, required this.lineTotal});
  

@override final  String productId;
@override final  String slug;
@override final  String name;
@override final  String unit;
@override final  String rootCategorySlug;
@override final  String? thumbUrl;
@override final  Money price;
@override final  Money? listPrice;
@override final  int quantity;
@override final  bool isAvailable;
@override final  Money? lineTotal;

/// Create a copy of CartLine
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CartLineCopyWith<_CartLine> get copyWith => __$CartLineCopyWithImpl<_CartLine>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CartLine&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.name, name) || other.name == name)&&(identical(other.unit, unit) || other.unit == unit)&&(identical(other.rootCategorySlug, rootCategorySlug) || other.rootCategorySlug == rootCategorySlug)&&(identical(other.thumbUrl, thumbUrl) || other.thumbUrl == thumbUrl)&&(identical(other.price, price) || other.price == price)&&(identical(other.listPrice, listPrice) || other.listPrice == listPrice)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.isAvailable, isAvailable) || other.isAvailable == isAvailable)&&(identical(other.lineTotal, lineTotal) || other.lineTotal == lineTotal));
}


@override
int get hashCode => Object.hash(runtimeType,productId,slug,name,unit,rootCategorySlug,thumbUrl,price,listPrice,quantity,isAvailable,lineTotal);

@override
String toString() {
  return 'CartLine(productId: $productId, slug: $slug, name: $name, unit: $unit, rootCategorySlug: $rootCategorySlug, thumbUrl: $thumbUrl, price: $price, listPrice: $listPrice, quantity: $quantity, isAvailable: $isAvailable, lineTotal: $lineTotal)';
}


}

/// @nodoc
abstract mixin class _$CartLineCopyWith<$Res> implements $CartLineCopyWith<$Res> {
  factory _$CartLineCopyWith(_CartLine value, $Res Function(_CartLine) _then) = __$CartLineCopyWithImpl;
@override @useResult
$Res call({
 String productId, String slug, String name, String unit, String rootCategorySlug, String? thumbUrl, Money price, Money? listPrice, int quantity, bool isAvailable, Money? lineTotal
});




}
/// @nodoc
class __$CartLineCopyWithImpl<$Res>
    implements _$CartLineCopyWith<$Res> {
  __$CartLineCopyWithImpl(this._self, this._then);

  final _CartLine _self;
  final $Res Function(_CartLine) _then;

/// Create a copy of CartLine
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? productId = null,Object? slug = null,Object? name = null,Object? unit = null,Object? rootCategorySlug = null,Object? thumbUrl = freezed,Object? price = null,Object? listPrice = freezed,Object? quantity = null,Object? isAvailable = null,Object? lineTotal = freezed,}) {
  return _then(_CartLine(
productId: null == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,unit: null == unit ? _self.unit : unit // ignore: cast_nullable_to_non_nullable
as String,rootCategorySlug: null == rootCategorySlug ? _self.rootCategorySlug : rootCategorySlug // ignore: cast_nullable_to_non_nullable
as String,thumbUrl: freezed == thumbUrl ? _self.thumbUrl : thumbUrl // ignore: cast_nullable_to_non_nullable
as String?,price: null == price ? _self.price : price // ignore: cast_nullable_to_non_nullable
as Money,listPrice: freezed == listPrice ? _self.listPrice : listPrice // ignore: cast_nullable_to_non_nullable
as Money?,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as int,isAvailable: null == isAvailable ? _self.isAvailable : isAvailable // ignore: cast_nullable_to_non_nullable
as bool,lineTotal: freezed == lineTotal ? _self.lineTotal : lineTotal // ignore: cast_nullable_to_non_nullable
as Money?,
  ));
}


}

/// @nodoc
mixin _$CartDetail {

 List<CartLine> get lines; int get itemCount; Money get subtotal; Money get deliveryFee; Money get total; Money get freeDeliveryThreshold; Money get missingForFreeDelivery; bool get hasUnavailableItems;
/// Create a copy of CartDetail
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CartDetailCopyWith<CartDetail> get copyWith => _$CartDetailCopyWithImpl<CartDetail>(this as CartDetail, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CartDetail&&const DeepCollectionEquality().equals(other.lines, lines)&&(identical(other.itemCount, itemCount) || other.itemCount == itemCount)&&(identical(other.subtotal, subtotal) || other.subtotal == subtotal)&&(identical(other.deliveryFee, deliveryFee) || other.deliveryFee == deliveryFee)&&(identical(other.total, total) || other.total == total)&&(identical(other.freeDeliveryThreshold, freeDeliveryThreshold) || other.freeDeliveryThreshold == freeDeliveryThreshold)&&(identical(other.missingForFreeDelivery, missingForFreeDelivery) || other.missingForFreeDelivery == missingForFreeDelivery)&&(identical(other.hasUnavailableItems, hasUnavailableItems) || other.hasUnavailableItems == hasUnavailableItems));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(lines),itemCount,subtotal,deliveryFee,total,freeDeliveryThreshold,missingForFreeDelivery,hasUnavailableItems);

@override
String toString() {
  return 'CartDetail(lines: $lines, itemCount: $itemCount, subtotal: $subtotal, deliveryFee: $deliveryFee, total: $total, freeDeliveryThreshold: $freeDeliveryThreshold, missingForFreeDelivery: $missingForFreeDelivery, hasUnavailableItems: $hasUnavailableItems)';
}


}

/// @nodoc
abstract mixin class $CartDetailCopyWith<$Res>  {
  factory $CartDetailCopyWith(CartDetail value, $Res Function(CartDetail) _then) = _$CartDetailCopyWithImpl;
@useResult
$Res call({
 List<CartLine> lines, int itemCount, Money subtotal, Money deliveryFee, Money total, Money freeDeliveryThreshold, Money missingForFreeDelivery, bool hasUnavailableItems
});




}
/// @nodoc
class _$CartDetailCopyWithImpl<$Res>
    implements $CartDetailCopyWith<$Res> {
  _$CartDetailCopyWithImpl(this._self, this._then);

  final CartDetail _self;
  final $Res Function(CartDetail) _then;

/// Create a copy of CartDetail
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? lines = null,Object? itemCount = null,Object? subtotal = null,Object? deliveryFee = null,Object? total = null,Object? freeDeliveryThreshold = null,Object? missingForFreeDelivery = null,Object? hasUnavailableItems = null,}) {
  return _then(CartDetail(
lines: null == lines ? _self.lines : lines // ignore: cast_nullable_to_non_nullable
as List<CartLine>,itemCount: null == itemCount ? _self.itemCount : itemCount // ignore: cast_nullable_to_non_nullable
as int,subtotal: null == subtotal ? _self.subtotal : subtotal // ignore: cast_nullable_to_non_nullable
as Money,deliveryFee: null == deliveryFee ? _self.deliveryFee : deliveryFee // ignore: cast_nullable_to_non_nullable
as Money,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as Money,freeDeliveryThreshold: null == freeDeliveryThreshold ? _self.freeDeliveryThreshold : freeDeliveryThreshold // ignore: cast_nullable_to_non_nullable
as Money,missingForFreeDelivery: null == missingForFreeDelivery ? _self.missingForFreeDelivery : missingForFreeDelivery // ignore: cast_nullable_to_non_nullable
as Money,hasUnavailableItems: null == hasUnavailableItems ? _self.hasUnavailableItems : hasUnavailableItems // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [CartDetail].
extension CartDetailPatterns on CartDetail {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CartDetail value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CartDetail() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CartDetail value)  $default,){
final _that = this;
switch (_that) {
case _CartDetail():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CartDetail value)?  $default,){
final _that = this;
switch (_that) {
case _CartDetail() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<CartLine> lines,  int itemCount,  Money subtotal,  Money deliveryFee,  Money total,  Money freeDeliveryThreshold,  Money missingForFreeDelivery,  bool hasUnavailableItems)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CartDetail() when $default != null:
return $default(_that.lines,_that.itemCount,_that.subtotal,_that.deliveryFee,_that.total,_that.freeDeliveryThreshold,_that.missingForFreeDelivery,_that.hasUnavailableItems);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<CartLine> lines,  int itemCount,  Money subtotal,  Money deliveryFee,  Money total,  Money freeDeliveryThreshold,  Money missingForFreeDelivery,  bool hasUnavailableItems)  $default,) {final _that = this;
switch (_that) {
case _CartDetail():
return $default(_that.lines,_that.itemCount,_that.subtotal,_that.deliveryFee,_that.total,_that.freeDeliveryThreshold,_that.missingForFreeDelivery,_that.hasUnavailableItems);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<CartLine> lines,  int itemCount,  Money subtotal,  Money deliveryFee,  Money total,  Money freeDeliveryThreshold,  Money missingForFreeDelivery,  bool hasUnavailableItems)?  $default,) {final _that = this;
switch (_that) {
case _CartDetail() when $default != null:
return $default(_that.lines,_that.itemCount,_that.subtotal,_that.deliveryFee,_that.total,_that.freeDeliveryThreshold,_that.missingForFreeDelivery,_that.hasUnavailableItems);case _:
  return null;

}
}

}

/// @nodoc


class _CartDetail implements CartDetail {
  const _CartDetail({required  List<CartLine> lines, required this.itemCount, required this.subtotal, required this.deliveryFee, required this.total, required this.freeDeliveryThreshold, required this.missingForFreeDelivery, required this.hasUnavailableItems}): _lines = lines;
  

 final  List<CartLine> _lines;
@override List<CartLine> get lines {
  if (_lines is EqualUnmodifiableListView) return _lines;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_lines);
}

@override final  int itemCount;
@override final  Money subtotal;
@override final  Money deliveryFee;
@override final  Money total;
@override final  Money freeDeliveryThreshold;
@override final  Money missingForFreeDelivery;
@override final  bool hasUnavailableItems;

/// Create a copy of CartDetail
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CartDetailCopyWith<_CartDetail> get copyWith => __$CartDetailCopyWithImpl<_CartDetail>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CartDetail&&const DeepCollectionEquality().equals(other._lines, _lines)&&(identical(other.itemCount, itemCount) || other.itemCount == itemCount)&&(identical(other.subtotal, subtotal) || other.subtotal == subtotal)&&(identical(other.deliveryFee, deliveryFee) || other.deliveryFee == deliveryFee)&&(identical(other.total, total) || other.total == total)&&(identical(other.freeDeliveryThreshold, freeDeliveryThreshold) || other.freeDeliveryThreshold == freeDeliveryThreshold)&&(identical(other.missingForFreeDelivery, missingForFreeDelivery) || other.missingForFreeDelivery == missingForFreeDelivery)&&(identical(other.hasUnavailableItems, hasUnavailableItems) || other.hasUnavailableItems == hasUnavailableItems));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_lines),itemCount,subtotal,deliveryFee,total,freeDeliveryThreshold,missingForFreeDelivery,hasUnavailableItems);

@override
String toString() {
  return 'CartDetail(lines: $lines, itemCount: $itemCount, subtotal: $subtotal, deliveryFee: $deliveryFee, total: $total, freeDeliveryThreshold: $freeDeliveryThreshold, missingForFreeDelivery: $missingForFreeDelivery, hasUnavailableItems: $hasUnavailableItems)';
}


}

/// @nodoc
abstract mixin class _$CartDetailCopyWith<$Res> implements $CartDetailCopyWith<$Res> {
  factory _$CartDetailCopyWith(_CartDetail value, $Res Function(_CartDetail) _then) = __$CartDetailCopyWithImpl;
@override @useResult
$Res call({
 List<CartLine> lines, int itemCount, Money subtotal, Money deliveryFee, Money total, Money freeDeliveryThreshold, Money missingForFreeDelivery, bool hasUnavailableItems
});




}
/// @nodoc
class __$CartDetailCopyWithImpl<$Res>
    implements _$CartDetailCopyWith<$Res> {
  __$CartDetailCopyWithImpl(this._self, this._then);

  final _CartDetail _self;
  final $Res Function(_CartDetail) _then;

/// Create a copy of CartDetail
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? lines = null,Object? itemCount = null,Object? subtotal = null,Object? deliveryFee = null,Object? total = null,Object? freeDeliveryThreshold = null,Object? missingForFreeDelivery = null,Object? hasUnavailableItems = null,}) {
  return _then(_CartDetail(
lines: null == lines ? _self._lines : lines // ignore: cast_nullable_to_non_nullable
as List<CartLine>,itemCount: null == itemCount ? _self.itemCount : itemCount // ignore: cast_nullable_to_non_nullable
as int,subtotal: null == subtotal ? _self.subtotal : subtotal // ignore: cast_nullable_to_non_nullable
as Money,deliveryFee: null == deliveryFee ? _self.deliveryFee : deliveryFee // ignore: cast_nullable_to_non_nullable
as Money,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as Money,freeDeliveryThreshold: null == freeDeliveryThreshold ? _self.freeDeliveryThreshold : freeDeliveryThreshold // ignore: cast_nullable_to_non_nullable
as Money,missingForFreeDelivery: null == missingForFreeDelivery ? _self.missingForFreeDelivery : missingForFreeDelivery // ignore: cast_nullable_to_non_nullable
as Money,hasUnavailableItems: null == hasUnavailableItems ? _self.hasUnavailableItems : hasUnavailableItems // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}

// dart format on
