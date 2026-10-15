// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'order_entity.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$OrderItem {

 String get productId; String get name; String get unit; String? get thumbUrl; Money get unitPrice; int get quantity; Money get lineTotal;
/// Create a copy of OrderItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$OrderItemCopyWith<OrderItem> get copyWith => _$OrderItemCopyWithImpl<OrderItem>(this as OrderItem, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is OrderItem&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.name, name) || other.name == name)&&(identical(other.unit, unit) || other.unit == unit)&&(identical(other.thumbUrl, thumbUrl) || other.thumbUrl == thumbUrl)&&(identical(other.unitPrice, unitPrice) || other.unitPrice == unitPrice)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.lineTotal, lineTotal) || other.lineTotal == lineTotal));
}


@override
int get hashCode => Object.hash(runtimeType,productId,name,unit,thumbUrl,unitPrice,quantity,lineTotal);

@override
String toString() {
  return 'OrderItem(productId: $productId, name: $name, unit: $unit, thumbUrl: $thumbUrl, unitPrice: $unitPrice, quantity: $quantity, lineTotal: $lineTotal)';
}


}

/// @nodoc
abstract mixin class $OrderItemCopyWith<$Res>  {
  factory $OrderItemCopyWith(OrderItem value, $Res Function(OrderItem) _then) = _$OrderItemCopyWithImpl;
@useResult
$Res call({
 String productId, String name, String unit, String? thumbUrl, Money unitPrice, int quantity, Money lineTotal
});




}
/// @nodoc
class _$OrderItemCopyWithImpl<$Res>
    implements $OrderItemCopyWith<$Res> {
  _$OrderItemCopyWithImpl(this._self, this._then);

  final OrderItem _self;
  final $Res Function(OrderItem) _then;

/// Create a copy of OrderItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? productId = null,Object? name = null,Object? unit = null,Object? thumbUrl = freezed,Object? unitPrice = null,Object? quantity = null,Object? lineTotal = null,}) {
  return _then(OrderItem(
productId: null == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,unit: null == unit ? _self.unit : unit // ignore: cast_nullable_to_non_nullable
as String,thumbUrl: freezed == thumbUrl ? _self.thumbUrl : thumbUrl // ignore: cast_nullable_to_non_nullable
as String?,unitPrice: null == unitPrice ? _self.unitPrice : unitPrice // ignore: cast_nullable_to_non_nullable
as Money,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as int,lineTotal: null == lineTotal ? _self.lineTotal : lineTotal // ignore: cast_nullable_to_non_nullable
as Money,
  ));
}

}


/// Adds pattern-matching-related methods to [OrderItem].
extension OrderItemPatterns on OrderItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _OrderItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _OrderItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _OrderItem value)  $default,){
final _that = this;
switch (_that) {
case _OrderItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _OrderItem value)?  $default,){
final _that = this;
switch (_that) {
case _OrderItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String productId,  String name,  String unit,  String? thumbUrl,  Money unitPrice,  int quantity,  Money lineTotal)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _OrderItem() when $default != null:
return $default(_that.productId,_that.name,_that.unit,_that.thumbUrl,_that.unitPrice,_that.quantity,_that.lineTotal);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String productId,  String name,  String unit,  String? thumbUrl,  Money unitPrice,  int quantity,  Money lineTotal)  $default,) {final _that = this;
switch (_that) {
case _OrderItem():
return $default(_that.productId,_that.name,_that.unit,_that.thumbUrl,_that.unitPrice,_that.quantity,_that.lineTotal);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String productId,  String name,  String unit,  String? thumbUrl,  Money unitPrice,  int quantity,  Money lineTotal)?  $default,) {final _that = this;
switch (_that) {
case _OrderItem() when $default != null:
return $default(_that.productId,_that.name,_that.unit,_that.thumbUrl,_that.unitPrice,_that.quantity,_that.lineTotal);case _:
  return null;

}
}

}

/// @nodoc


class _OrderItem implements OrderItem {
  const _OrderItem({required this.productId, required this.name, required this.unit, required this.thumbUrl, required this.unitPrice, required this.quantity, required this.lineTotal});
  

@override final  String productId;
@override final  String name;
@override final  String unit;
@override final  String? thumbUrl;
@override final  Money unitPrice;
@override final  int quantity;
@override final  Money lineTotal;

/// Create a copy of OrderItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$OrderItemCopyWith<_OrderItem> get copyWith => __$OrderItemCopyWithImpl<_OrderItem>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _OrderItem&&(identical(other.productId, productId) || other.productId == productId)&&(identical(other.name, name) || other.name == name)&&(identical(other.unit, unit) || other.unit == unit)&&(identical(other.thumbUrl, thumbUrl) || other.thumbUrl == thumbUrl)&&(identical(other.unitPrice, unitPrice) || other.unitPrice == unitPrice)&&(identical(other.quantity, quantity) || other.quantity == quantity)&&(identical(other.lineTotal, lineTotal) || other.lineTotal == lineTotal));
}


@override
int get hashCode => Object.hash(runtimeType,productId,name,unit,thumbUrl,unitPrice,quantity,lineTotal);

@override
String toString() {
  return 'OrderItem(productId: $productId, name: $name, unit: $unit, thumbUrl: $thumbUrl, unitPrice: $unitPrice, quantity: $quantity, lineTotal: $lineTotal)';
}


}

/// @nodoc
abstract mixin class _$OrderItemCopyWith<$Res> implements $OrderItemCopyWith<$Res> {
  factory _$OrderItemCopyWith(_OrderItem value, $Res Function(_OrderItem) _then) = __$OrderItemCopyWithImpl;
@override @useResult
$Res call({
 String productId, String name, String unit, String? thumbUrl, Money unitPrice, int quantity, Money lineTotal
});




}
/// @nodoc
class __$OrderItemCopyWithImpl<$Res>
    implements _$OrderItemCopyWith<$Res> {
  __$OrderItemCopyWithImpl(this._self, this._then);

  final _OrderItem _self;
  final $Res Function(_OrderItem) _then;

/// Create a copy of OrderItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? productId = null,Object? name = null,Object? unit = null,Object? thumbUrl = freezed,Object? unitPrice = null,Object? quantity = null,Object? lineTotal = null,}) {
  return _then(_OrderItem(
productId: null == productId ? _self.productId : productId // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,unit: null == unit ? _self.unit : unit // ignore: cast_nullable_to_non_nullable
as String,thumbUrl: freezed == thumbUrl ? _self.thumbUrl : thumbUrl // ignore: cast_nullable_to_non_nullable
as String?,unitPrice: null == unitPrice ? _self.unitPrice : unitPrice // ignore: cast_nullable_to_non_nullable
as Money,quantity: null == quantity ? _self.quantity : quantity // ignore: cast_nullable_to_non_nullable
as int,lineTotal: null == lineTotal ? _self.lineTotal : lineTotal // ignore: cast_nullable_to_non_nullable
as Money,
  ));
}


}

/// @nodoc
mixin _$OrderDeliveryAddress {

 String get zipCode; String get street; String get number; String? get complement; String get neighborhood; String get city; String get state;
/// Create a copy of OrderDeliveryAddress
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$OrderDeliveryAddressCopyWith<OrderDeliveryAddress> get copyWith => _$OrderDeliveryAddressCopyWithImpl<OrderDeliveryAddress>(this as OrderDeliveryAddress, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is OrderDeliveryAddress&&(identical(other.zipCode, zipCode) || other.zipCode == zipCode)&&(identical(other.street, street) || other.street == street)&&(identical(other.number, number) || other.number == number)&&(identical(other.complement, complement) || other.complement == complement)&&(identical(other.neighborhood, neighborhood) || other.neighborhood == neighborhood)&&(identical(other.city, city) || other.city == city)&&(identical(other.state, state) || other.state == state));
}


@override
int get hashCode => Object.hash(runtimeType,zipCode,street,number,complement,neighborhood,city,state);

@override
String toString() {
  return 'OrderDeliveryAddress(zipCode: $zipCode, street: $street, number: $number, complement: $complement, neighborhood: $neighborhood, city: $city, state: $state)';
}


}

/// @nodoc
abstract mixin class $OrderDeliveryAddressCopyWith<$Res>  {
  factory $OrderDeliveryAddressCopyWith(OrderDeliveryAddress value, $Res Function(OrderDeliveryAddress) _then) = _$OrderDeliveryAddressCopyWithImpl;
@useResult
$Res call({
 String zipCode, String street, String number, String? complement, String neighborhood, String city, String state
});




}
/// @nodoc
class _$OrderDeliveryAddressCopyWithImpl<$Res>
    implements $OrderDeliveryAddressCopyWith<$Res> {
  _$OrderDeliveryAddressCopyWithImpl(this._self, this._then);

  final OrderDeliveryAddress _self;
  final $Res Function(OrderDeliveryAddress) _then;

/// Create a copy of OrderDeliveryAddress
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? zipCode = null,Object? street = null,Object? number = null,Object? complement = freezed,Object? neighborhood = null,Object? city = null,Object? state = null,}) {
  return _then(OrderDeliveryAddress(
zipCode: null == zipCode ? _self.zipCode : zipCode // ignore: cast_nullable_to_non_nullable
as String,street: null == street ? _self.street : street // ignore: cast_nullable_to_non_nullable
as String,number: null == number ? _self.number : number // ignore: cast_nullable_to_non_nullable
as String,complement: freezed == complement ? _self.complement : complement // ignore: cast_nullable_to_non_nullable
as String?,neighborhood: null == neighborhood ? _self.neighborhood : neighborhood // ignore: cast_nullable_to_non_nullable
as String,city: null == city ? _self.city : city // ignore: cast_nullable_to_non_nullable
as String,state: null == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [OrderDeliveryAddress].
extension OrderDeliveryAddressPatterns on OrderDeliveryAddress {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _OrderDeliveryAddress value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _OrderDeliveryAddress() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _OrderDeliveryAddress value)  $default,){
final _that = this;
switch (_that) {
case _OrderDeliveryAddress():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _OrderDeliveryAddress value)?  $default,){
final _that = this;
switch (_that) {
case _OrderDeliveryAddress() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String zipCode,  String street,  String number,  String? complement,  String neighborhood,  String city,  String state)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _OrderDeliveryAddress() when $default != null:
return $default(_that.zipCode,_that.street,_that.number,_that.complement,_that.neighborhood,_that.city,_that.state);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String zipCode,  String street,  String number,  String? complement,  String neighborhood,  String city,  String state)  $default,) {final _that = this;
switch (_that) {
case _OrderDeliveryAddress():
return $default(_that.zipCode,_that.street,_that.number,_that.complement,_that.neighborhood,_that.city,_that.state);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String zipCode,  String street,  String number,  String? complement,  String neighborhood,  String city,  String state)?  $default,) {final _that = this;
switch (_that) {
case _OrderDeliveryAddress() when $default != null:
return $default(_that.zipCode,_that.street,_that.number,_that.complement,_that.neighborhood,_that.city,_that.state);case _:
  return null;

}
}

}

/// @nodoc


class _OrderDeliveryAddress implements OrderDeliveryAddress {
  const _OrderDeliveryAddress({required this.zipCode, required this.street, required this.number, required this.complement, required this.neighborhood, required this.city, required this.state});
  

@override final  String zipCode;
@override final  String street;
@override final  String number;
@override final  String? complement;
@override final  String neighborhood;
@override final  String city;
@override final  String state;

/// Create a copy of OrderDeliveryAddress
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$OrderDeliveryAddressCopyWith<_OrderDeliveryAddress> get copyWith => __$OrderDeliveryAddressCopyWithImpl<_OrderDeliveryAddress>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _OrderDeliveryAddress&&(identical(other.zipCode, zipCode) || other.zipCode == zipCode)&&(identical(other.street, street) || other.street == street)&&(identical(other.number, number) || other.number == number)&&(identical(other.complement, complement) || other.complement == complement)&&(identical(other.neighborhood, neighborhood) || other.neighborhood == neighborhood)&&(identical(other.city, city) || other.city == city)&&(identical(other.state, state) || other.state == state));
}


@override
int get hashCode => Object.hash(runtimeType,zipCode,street,number,complement,neighborhood,city,state);

@override
String toString() {
  return 'OrderDeliveryAddress(zipCode: $zipCode, street: $street, number: $number, complement: $complement, neighborhood: $neighborhood, city: $city, state: $state)';
}


}

/// @nodoc
abstract mixin class _$OrderDeliveryAddressCopyWith<$Res> implements $OrderDeliveryAddressCopyWith<$Res> {
  factory _$OrderDeliveryAddressCopyWith(_OrderDeliveryAddress value, $Res Function(_OrderDeliveryAddress) _then) = __$OrderDeliveryAddressCopyWithImpl;
@override @useResult
$Res call({
 String zipCode, String street, String number, String? complement, String neighborhood, String city, String state
});




}
/// @nodoc
class __$OrderDeliveryAddressCopyWithImpl<$Res>
    implements _$OrderDeliveryAddressCopyWith<$Res> {
  __$OrderDeliveryAddressCopyWithImpl(this._self, this._then);

  final _OrderDeliveryAddress _self;
  final $Res Function(_OrderDeliveryAddress) _then;

/// Create a copy of OrderDeliveryAddress
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? zipCode = null,Object? street = null,Object? number = null,Object? complement = freezed,Object? neighborhood = null,Object? city = null,Object? state = null,}) {
  return _then(_OrderDeliveryAddress(
zipCode: null == zipCode ? _self.zipCode : zipCode // ignore: cast_nullable_to_non_nullable
as String,street: null == street ? _self.street : street // ignore: cast_nullable_to_non_nullable
as String,number: null == number ? _self.number : number // ignore: cast_nullable_to_non_nullable
as String,complement: freezed == complement ? _self.complement : complement // ignore: cast_nullable_to_non_nullable
as String?,neighborhood: null == neighborhood ? _self.neighborhood : neighborhood // ignore: cast_nullable_to_non_nullable
as String,city: null == city ? _self.city : city // ignore: cast_nullable_to_non_nullable
as String,state: null == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

/// @nodoc
mixin _$OrderDetail {

 String get id; OrderStatus get status; List<OrderItem> get items; OrderDeliveryAddress get deliveryAddress; String get recipientName; String? get deliveryInstructions; int get itemCount; Money get subtotal; Money get deliveryFee; Money get total; DateTime get placedAt; DateTime? get paymentApprovedAt; DateTime? get pickingStartedAt; DateTime? get outForDeliveryAt; DateTime? get deliveredAt;
/// Create a copy of OrderDetail
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$OrderDetailCopyWith<OrderDetail> get copyWith => _$OrderDetailCopyWithImpl<OrderDetail>(this as OrderDetail, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is OrderDetail&&(identical(other.id, id) || other.id == id)&&(identical(other.status, status) || other.status == status)&&const DeepCollectionEquality().equals(other.items, items)&&(identical(other.deliveryAddress, deliveryAddress) || other.deliveryAddress == deliveryAddress)&&(identical(other.recipientName, recipientName) || other.recipientName == recipientName)&&(identical(other.deliveryInstructions, deliveryInstructions) || other.deliveryInstructions == deliveryInstructions)&&(identical(other.itemCount, itemCount) || other.itemCount == itemCount)&&(identical(other.subtotal, subtotal) || other.subtotal == subtotal)&&(identical(other.deliveryFee, deliveryFee) || other.deliveryFee == deliveryFee)&&(identical(other.total, total) || other.total == total)&&(identical(other.placedAt, placedAt) || other.placedAt == placedAt)&&(identical(other.paymentApprovedAt, paymentApprovedAt) || other.paymentApprovedAt == paymentApprovedAt)&&(identical(other.pickingStartedAt, pickingStartedAt) || other.pickingStartedAt == pickingStartedAt)&&(identical(other.outForDeliveryAt, outForDeliveryAt) || other.outForDeliveryAt == outForDeliveryAt)&&(identical(other.deliveredAt, deliveredAt) || other.deliveredAt == deliveredAt));
}


@override
int get hashCode => Object.hash(runtimeType,id,status,const DeepCollectionEquality().hash(items),deliveryAddress,recipientName,deliveryInstructions,itemCount,subtotal,deliveryFee,total,placedAt,paymentApprovedAt,pickingStartedAt,outForDeliveryAt,deliveredAt);

@override
String toString() {
  return 'OrderDetail(id: $id, status: $status, items: $items, deliveryAddress: $deliveryAddress, recipientName: $recipientName, deliveryInstructions: $deliveryInstructions, itemCount: $itemCount, subtotal: $subtotal, deliveryFee: $deliveryFee, total: $total, placedAt: $placedAt, paymentApprovedAt: $paymentApprovedAt, pickingStartedAt: $pickingStartedAt, outForDeliveryAt: $outForDeliveryAt, deliveredAt: $deliveredAt)';
}


}

/// @nodoc
abstract mixin class $OrderDetailCopyWith<$Res>  {
  factory $OrderDetailCopyWith(OrderDetail value, $Res Function(OrderDetail) _then) = _$OrderDetailCopyWithImpl;
@useResult
$Res call({
 String id, OrderStatus status, List<OrderItem> items, OrderDeliveryAddress deliveryAddress, String recipientName, String? deliveryInstructions, int itemCount, Money subtotal, Money deliveryFee, Money total, DateTime placedAt, DateTime? paymentApprovedAt, DateTime? pickingStartedAt, DateTime? outForDeliveryAt, DateTime? deliveredAt
});


$OrderDeliveryAddressCopyWith<$Res> get deliveryAddress;

}
/// @nodoc
class _$OrderDetailCopyWithImpl<$Res>
    implements $OrderDetailCopyWith<$Res> {
  _$OrderDetailCopyWithImpl(this._self, this._then);

  final OrderDetail _self;
  final $Res Function(OrderDetail) _then;

/// Create a copy of OrderDetail
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? status = null,Object? items = null,Object? deliveryAddress = null,Object? recipientName = null,Object? deliveryInstructions = freezed,Object? itemCount = null,Object? subtotal = null,Object? deliveryFee = null,Object? total = null,Object? placedAt = null,Object? paymentApprovedAt = freezed,Object? pickingStartedAt = freezed,Object? outForDeliveryAt = freezed,Object? deliveredAt = freezed,}) {
  return _then(OrderDetail(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as OrderStatus,items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<OrderItem>,deliveryAddress: null == deliveryAddress ? _self.deliveryAddress : deliveryAddress // ignore: cast_nullable_to_non_nullable
as OrderDeliveryAddress,recipientName: null == recipientName ? _self.recipientName : recipientName // ignore: cast_nullable_to_non_nullable
as String,deliveryInstructions: freezed == deliveryInstructions ? _self.deliveryInstructions : deliveryInstructions // ignore: cast_nullable_to_non_nullable
as String?,itemCount: null == itemCount ? _self.itemCount : itemCount // ignore: cast_nullable_to_non_nullable
as int,subtotal: null == subtotal ? _self.subtotal : subtotal // ignore: cast_nullable_to_non_nullable
as Money,deliveryFee: null == deliveryFee ? _self.deliveryFee : deliveryFee // ignore: cast_nullable_to_non_nullable
as Money,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as Money,placedAt: null == placedAt ? _self.placedAt : placedAt // ignore: cast_nullable_to_non_nullable
as DateTime,paymentApprovedAt: freezed == paymentApprovedAt ? _self.paymentApprovedAt : paymentApprovedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,pickingStartedAt: freezed == pickingStartedAt ? _self.pickingStartedAt : pickingStartedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,outForDeliveryAt: freezed == outForDeliveryAt ? _self.outForDeliveryAt : outForDeliveryAt // ignore: cast_nullable_to_non_nullable
as DateTime?,deliveredAt: freezed == deliveredAt ? _self.deliveredAt : deliveredAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}
/// Create a copy of OrderDetail
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$OrderDeliveryAddressCopyWith<$Res> get deliveryAddress {
  
  return $OrderDeliveryAddressCopyWith<$Res>(_self.deliveryAddress, (value) {
    return _then(_self.copyWith(deliveryAddress: value));
  });
}
}


/// Adds pattern-matching-related methods to [OrderDetail].
extension OrderDetailPatterns on OrderDetail {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _OrderDetail value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _OrderDetail() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _OrderDetail value)  $default,){
final _that = this;
switch (_that) {
case _OrderDetail():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _OrderDetail value)?  $default,){
final _that = this;
switch (_that) {
case _OrderDetail() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  OrderStatus status,  List<OrderItem> items,  OrderDeliveryAddress deliveryAddress,  String recipientName,  String? deliveryInstructions,  int itemCount,  Money subtotal,  Money deliveryFee,  Money total,  DateTime placedAt,  DateTime? paymentApprovedAt,  DateTime? pickingStartedAt,  DateTime? outForDeliveryAt,  DateTime? deliveredAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _OrderDetail() when $default != null:
return $default(_that.id,_that.status,_that.items,_that.deliveryAddress,_that.recipientName,_that.deliveryInstructions,_that.itemCount,_that.subtotal,_that.deliveryFee,_that.total,_that.placedAt,_that.paymentApprovedAt,_that.pickingStartedAt,_that.outForDeliveryAt,_that.deliveredAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  OrderStatus status,  List<OrderItem> items,  OrderDeliveryAddress deliveryAddress,  String recipientName,  String? deliveryInstructions,  int itemCount,  Money subtotal,  Money deliveryFee,  Money total,  DateTime placedAt,  DateTime? paymentApprovedAt,  DateTime? pickingStartedAt,  DateTime? outForDeliveryAt,  DateTime? deliveredAt)  $default,) {final _that = this;
switch (_that) {
case _OrderDetail():
return $default(_that.id,_that.status,_that.items,_that.deliveryAddress,_that.recipientName,_that.deliveryInstructions,_that.itemCount,_that.subtotal,_that.deliveryFee,_that.total,_that.placedAt,_that.paymentApprovedAt,_that.pickingStartedAt,_that.outForDeliveryAt,_that.deliveredAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  OrderStatus status,  List<OrderItem> items,  OrderDeliveryAddress deliveryAddress,  String recipientName,  String? deliveryInstructions,  int itemCount,  Money subtotal,  Money deliveryFee,  Money total,  DateTime placedAt,  DateTime? paymentApprovedAt,  DateTime? pickingStartedAt,  DateTime? outForDeliveryAt,  DateTime? deliveredAt)?  $default,) {final _that = this;
switch (_that) {
case _OrderDetail() when $default != null:
return $default(_that.id,_that.status,_that.items,_that.deliveryAddress,_that.recipientName,_that.deliveryInstructions,_that.itemCount,_that.subtotal,_that.deliveryFee,_that.total,_that.placedAt,_that.paymentApprovedAt,_that.pickingStartedAt,_that.outForDeliveryAt,_that.deliveredAt);case _:
  return null;

}
}

}

/// @nodoc


class _OrderDetail extends OrderDetail {
  const _OrderDetail({required this.id, required this.status, required  List<OrderItem> items, required this.deliveryAddress, required this.recipientName, required this.deliveryInstructions, required this.itemCount, required this.subtotal, required this.deliveryFee, required this.total, required this.placedAt, required this.paymentApprovedAt, required this.pickingStartedAt, required this.outForDeliveryAt, required this.deliveredAt}): _items = items,super._();
  

@override final  String id;
@override final  OrderStatus status;
 final  List<OrderItem> _items;
@override List<OrderItem> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}

@override final  OrderDeliveryAddress deliveryAddress;
@override final  String recipientName;
@override final  String? deliveryInstructions;
@override final  int itemCount;
@override final  Money subtotal;
@override final  Money deliveryFee;
@override final  Money total;
@override final  DateTime placedAt;
@override final  DateTime? paymentApprovedAt;
@override final  DateTime? pickingStartedAt;
@override final  DateTime? outForDeliveryAt;
@override final  DateTime? deliveredAt;

/// Create a copy of OrderDetail
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$OrderDetailCopyWith<_OrderDetail> get copyWith => __$OrderDetailCopyWithImpl<_OrderDetail>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _OrderDetail&&(identical(other.id, id) || other.id == id)&&(identical(other.status, status) || other.status == status)&&const DeepCollectionEquality().equals(other._items, _items)&&(identical(other.deliveryAddress, deliveryAddress) || other.deliveryAddress == deliveryAddress)&&(identical(other.recipientName, recipientName) || other.recipientName == recipientName)&&(identical(other.deliveryInstructions, deliveryInstructions) || other.deliveryInstructions == deliveryInstructions)&&(identical(other.itemCount, itemCount) || other.itemCount == itemCount)&&(identical(other.subtotal, subtotal) || other.subtotal == subtotal)&&(identical(other.deliveryFee, deliveryFee) || other.deliveryFee == deliveryFee)&&(identical(other.total, total) || other.total == total)&&(identical(other.placedAt, placedAt) || other.placedAt == placedAt)&&(identical(other.paymentApprovedAt, paymentApprovedAt) || other.paymentApprovedAt == paymentApprovedAt)&&(identical(other.pickingStartedAt, pickingStartedAt) || other.pickingStartedAt == pickingStartedAt)&&(identical(other.outForDeliveryAt, outForDeliveryAt) || other.outForDeliveryAt == outForDeliveryAt)&&(identical(other.deliveredAt, deliveredAt) || other.deliveredAt == deliveredAt));
}


@override
int get hashCode => Object.hash(runtimeType,id,status,const DeepCollectionEquality().hash(_items),deliveryAddress,recipientName,deliveryInstructions,itemCount,subtotal,deliveryFee,total,placedAt,paymentApprovedAt,pickingStartedAt,outForDeliveryAt,deliveredAt);

@override
String toString() {
  return 'OrderDetail(id: $id, status: $status, items: $items, deliveryAddress: $deliveryAddress, recipientName: $recipientName, deliveryInstructions: $deliveryInstructions, itemCount: $itemCount, subtotal: $subtotal, deliveryFee: $deliveryFee, total: $total, placedAt: $placedAt, paymentApprovedAt: $paymentApprovedAt, pickingStartedAt: $pickingStartedAt, outForDeliveryAt: $outForDeliveryAt, deliveredAt: $deliveredAt)';
}


}

/// @nodoc
abstract mixin class _$OrderDetailCopyWith<$Res> implements $OrderDetailCopyWith<$Res> {
  factory _$OrderDetailCopyWith(_OrderDetail value, $Res Function(_OrderDetail) _then) = __$OrderDetailCopyWithImpl;
@override @useResult
$Res call({
 String id, OrderStatus status, List<OrderItem> items, OrderDeliveryAddress deliveryAddress, String recipientName, String? deliveryInstructions, int itemCount, Money subtotal, Money deliveryFee, Money total, DateTime placedAt, DateTime? paymentApprovedAt, DateTime? pickingStartedAt, DateTime? outForDeliveryAt, DateTime? deliveredAt
});


@override $OrderDeliveryAddressCopyWith<$Res> get deliveryAddress;

}
/// @nodoc
class __$OrderDetailCopyWithImpl<$Res>
    implements _$OrderDetailCopyWith<$Res> {
  __$OrderDetailCopyWithImpl(this._self, this._then);

  final _OrderDetail _self;
  final $Res Function(_OrderDetail) _then;

/// Create a copy of OrderDetail
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? status = null,Object? items = null,Object? deliveryAddress = null,Object? recipientName = null,Object? deliveryInstructions = freezed,Object? itemCount = null,Object? subtotal = null,Object? deliveryFee = null,Object? total = null,Object? placedAt = null,Object? paymentApprovedAt = freezed,Object? pickingStartedAt = freezed,Object? outForDeliveryAt = freezed,Object? deliveredAt = freezed,}) {
  return _then(_OrderDetail(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as OrderStatus,items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<OrderItem>,deliveryAddress: null == deliveryAddress ? _self.deliveryAddress : deliveryAddress // ignore: cast_nullable_to_non_nullable
as OrderDeliveryAddress,recipientName: null == recipientName ? _self.recipientName : recipientName // ignore: cast_nullable_to_non_nullable
as String,deliveryInstructions: freezed == deliveryInstructions ? _self.deliveryInstructions : deliveryInstructions // ignore: cast_nullable_to_non_nullable
as String?,itemCount: null == itemCount ? _self.itemCount : itemCount // ignore: cast_nullable_to_non_nullable
as int,subtotal: null == subtotal ? _self.subtotal : subtotal // ignore: cast_nullable_to_non_nullable
as Money,deliveryFee: null == deliveryFee ? _self.deliveryFee : deliveryFee // ignore: cast_nullable_to_non_nullable
as Money,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as Money,placedAt: null == placedAt ? _self.placedAt : placedAt // ignore: cast_nullable_to_non_nullable
as DateTime,paymentApprovedAt: freezed == paymentApprovedAt ? _self.paymentApprovedAt : paymentApprovedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,pickingStartedAt: freezed == pickingStartedAt ? _self.pickingStartedAt : pickingStartedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,outForDeliveryAt: freezed == outForDeliveryAt ? _self.outForDeliveryAt : outForDeliveryAt // ignore: cast_nullable_to_non_nullable
as DateTime?,deliveredAt: freezed == deliveredAt ? _self.deliveredAt : deliveredAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

/// Create a copy of OrderDetail
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$OrderDeliveryAddressCopyWith<$Res> get deliveryAddress {
  
  return $OrderDeliveryAddressCopyWith<$Res>(_self.deliveryAddress, (value) {
    return _then(_self.copyWith(deliveryAddress: value));
  });
}
}

// dart format on
