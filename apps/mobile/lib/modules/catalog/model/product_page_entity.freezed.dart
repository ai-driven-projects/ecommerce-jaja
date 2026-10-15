// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'product_page_entity.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$BrandFacet {

 String get slug; String get name; int get count;
/// Create a copy of BrandFacet
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BrandFacetCopyWith<BrandFacet> get copyWith => _$BrandFacetCopyWithImpl<BrandFacet>(this as BrandFacet, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BrandFacet&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.name, name) || other.name == name)&&(identical(other.count, count) || other.count == count));
}


@override
int get hashCode => Object.hash(runtimeType,slug,name,count);

@override
String toString() {
  return 'BrandFacet(slug: $slug, name: $name, count: $count)';
}


}

/// @nodoc
abstract mixin class $BrandFacetCopyWith<$Res>  {
  factory $BrandFacetCopyWith(BrandFacet value, $Res Function(BrandFacet) _then) = _$BrandFacetCopyWithImpl;
@useResult
$Res call({
 String slug, String name, int count
});




}
/// @nodoc
class _$BrandFacetCopyWithImpl<$Res>
    implements $BrandFacetCopyWith<$Res> {
  _$BrandFacetCopyWithImpl(this._self, this._then);

  final BrandFacet _self;
  final $Res Function(BrandFacet) _then;

/// Create a copy of BrandFacet
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? slug = null,Object? name = null,Object? count = null,}) {
  return _then(BrandFacet(
slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,count: null == count ? _self.count : count // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [BrandFacet].
extension BrandFacetPatterns on BrandFacet {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BrandFacet value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BrandFacet() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BrandFacet value)  $default,){
final _that = this;
switch (_that) {
case _BrandFacet():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BrandFacet value)?  $default,){
final _that = this;
switch (_that) {
case _BrandFacet() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String slug,  String name,  int count)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BrandFacet() when $default != null:
return $default(_that.slug,_that.name,_that.count);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String slug,  String name,  int count)  $default,) {final _that = this;
switch (_that) {
case _BrandFacet():
return $default(_that.slug,_that.name,_that.count);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String slug,  String name,  int count)?  $default,) {final _that = this;
switch (_that) {
case _BrandFacet() when $default != null:
return $default(_that.slug,_that.name,_that.count);case _:
  return null;

}
}

}

/// @nodoc


class _BrandFacet implements BrandFacet {
  const _BrandFacet({required this.slug, required this.name, required this.count});
  

@override final  String slug;
@override final  String name;
@override final  int count;

/// Create a copy of BrandFacet
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BrandFacetCopyWith<_BrandFacet> get copyWith => __$BrandFacetCopyWithImpl<_BrandFacet>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _BrandFacet&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.name, name) || other.name == name)&&(identical(other.count, count) || other.count == count));
}


@override
int get hashCode => Object.hash(runtimeType,slug,name,count);

@override
String toString() {
  return 'BrandFacet(slug: $slug, name: $name, count: $count)';
}


}

/// @nodoc
abstract mixin class _$BrandFacetCopyWith<$Res> implements $BrandFacetCopyWith<$Res> {
  factory _$BrandFacetCopyWith(_BrandFacet value, $Res Function(_BrandFacet) _then) = __$BrandFacetCopyWithImpl;
@override @useResult
$Res call({
 String slug, String name, int count
});




}
/// @nodoc
class __$BrandFacetCopyWithImpl<$Res>
    implements _$BrandFacetCopyWith<$Res> {
  __$BrandFacetCopyWithImpl(this._self, this._then);

  final _BrandFacet _self;
  final $Res Function(_BrandFacet) _then;

/// Create a copy of BrandFacet
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? slug = null,Object? name = null,Object? count = null,}) {
  return _then(_BrandFacet(
slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,count: null == count ? _self.count : count // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

/// @nodoc
mixin _$ProductPage {

 List<ProductSummary> get items; int get total; int get page; int get pageSize; int get totalPages; List<BrandFacet> get brandFacets;
/// Create a copy of ProductPage
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProductPageCopyWith<ProductPage> get copyWith => _$ProductPageCopyWithImpl<ProductPage>(this as ProductPage, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ProductPage&&const DeepCollectionEquality().equals(other.items, items)&&(identical(other.total, total) || other.total == total)&&(identical(other.page, page) || other.page == page)&&(identical(other.pageSize, pageSize) || other.pageSize == pageSize)&&(identical(other.totalPages, totalPages) || other.totalPages == totalPages)&&const DeepCollectionEquality().equals(other.brandFacets, brandFacets));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(items),total,page,pageSize,totalPages,const DeepCollectionEquality().hash(brandFacets));

@override
String toString() {
  return 'ProductPage(items: $items, total: $total, page: $page, pageSize: $pageSize, totalPages: $totalPages, brandFacets: $brandFacets)';
}


}

/// @nodoc
abstract mixin class $ProductPageCopyWith<$Res>  {
  factory $ProductPageCopyWith(ProductPage value, $Res Function(ProductPage) _then) = _$ProductPageCopyWithImpl;
@useResult
$Res call({
 List<ProductSummary> items, int total, int page, int pageSize, int totalPages, List<BrandFacet> brandFacets
});




}
/// @nodoc
class _$ProductPageCopyWithImpl<$Res>
    implements $ProductPageCopyWith<$Res> {
  _$ProductPageCopyWithImpl(this._self, this._then);

  final ProductPage _self;
  final $Res Function(ProductPage) _then;

/// Create a copy of ProductPage
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? items = null,Object? total = null,Object? page = null,Object? pageSize = null,Object? totalPages = null,Object? brandFacets = null,}) {
  return _then(ProductPage(
items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<ProductSummary>,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,page: null == page ? _self.page : page // ignore: cast_nullable_to_non_nullable
as int,pageSize: null == pageSize ? _self.pageSize : pageSize // ignore: cast_nullable_to_non_nullable
as int,totalPages: null == totalPages ? _self.totalPages : totalPages // ignore: cast_nullable_to_non_nullable
as int,brandFacets: null == brandFacets ? _self.brandFacets : brandFacets // ignore: cast_nullable_to_non_nullable
as List<BrandFacet>,
  ));
}

}


/// Adds pattern-matching-related methods to [ProductPage].
extension ProductPagePatterns on ProductPage {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ProductPage value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ProductPage() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ProductPage value)  $default,){
final _that = this;
switch (_that) {
case _ProductPage():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ProductPage value)?  $default,){
final _that = this;
switch (_that) {
case _ProductPage() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<ProductSummary> items,  int total,  int page,  int pageSize,  int totalPages,  List<BrandFacet> brandFacets)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ProductPage() when $default != null:
return $default(_that.items,_that.total,_that.page,_that.pageSize,_that.totalPages,_that.brandFacets);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<ProductSummary> items,  int total,  int page,  int pageSize,  int totalPages,  List<BrandFacet> brandFacets)  $default,) {final _that = this;
switch (_that) {
case _ProductPage():
return $default(_that.items,_that.total,_that.page,_that.pageSize,_that.totalPages,_that.brandFacets);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<ProductSummary> items,  int total,  int page,  int pageSize,  int totalPages,  List<BrandFacet> brandFacets)?  $default,) {final _that = this;
switch (_that) {
case _ProductPage() when $default != null:
return $default(_that.items,_that.total,_that.page,_that.pageSize,_that.totalPages,_that.brandFacets);case _:
  return null;

}
}

}

/// @nodoc


class _ProductPage implements ProductPage {
  const _ProductPage({required  List<ProductSummary> items, required this.total, required this.page, required this.pageSize, required this.totalPages, required  List<BrandFacet> brandFacets}): _items = items,_brandFacets = brandFacets;
  

 final  List<ProductSummary> _items;
@override List<ProductSummary> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}

@override final  int total;
@override final  int page;
@override final  int pageSize;
@override final  int totalPages;
 final  List<BrandFacet> _brandFacets;
@override List<BrandFacet> get brandFacets {
  if (_brandFacets is EqualUnmodifiableListView) return _brandFacets;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_brandFacets);
}


/// Create a copy of ProductPage
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProductPageCopyWith<_ProductPage> get copyWith => __$ProductPageCopyWithImpl<_ProductPage>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ProductPage&&const DeepCollectionEquality().equals(other._items, _items)&&(identical(other.total, total) || other.total == total)&&(identical(other.page, page) || other.page == page)&&(identical(other.pageSize, pageSize) || other.pageSize == pageSize)&&(identical(other.totalPages, totalPages) || other.totalPages == totalPages)&&const DeepCollectionEquality().equals(other._brandFacets, _brandFacets));
}


@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_items),total,page,pageSize,totalPages,const DeepCollectionEquality().hash(_brandFacets));

@override
String toString() {
  return 'ProductPage(items: $items, total: $total, page: $page, pageSize: $pageSize, totalPages: $totalPages, brandFacets: $brandFacets)';
}


}

/// @nodoc
abstract mixin class _$ProductPageCopyWith<$Res> implements $ProductPageCopyWith<$Res> {
  factory _$ProductPageCopyWith(_ProductPage value, $Res Function(_ProductPage) _then) = __$ProductPageCopyWithImpl;
@override @useResult
$Res call({
 List<ProductSummary> items, int total, int page, int pageSize, int totalPages, List<BrandFacet> brandFacets
});




}
/// @nodoc
class __$ProductPageCopyWithImpl<$Res>
    implements _$ProductPageCopyWith<$Res> {
  __$ProductPageCopyWithImpl(this._self, this._then);

  final _ProductPage _self;
  final $Res Function(_ProductPage) _then;

/// Create a copy of ProductPage
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? items = null,Object? total = null,Object? page = null,Object? pageSize = null,Object? totalPages = null,Object? brandFacets = null,}) {
  return _then(_ProductPage(
items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<ProductSummary>,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,page: null == page ? _self.page : page // ignore: cast_nullable_to_non_nullable
as int,pageSize: null == pageSize ? _self.pageSize : pageSize // ignore: cast_nullable_to_non_nullable
as int,totalPages: null == totalPages ? _self.totalPages : totalPages // ignore: cast_nullable_to_non_nullable
as int,brandFacets: null == brandFacets ? _self._brandFacets : brandFacets // ignore: cast_nullable_to_non_nullable
as List<BrandFacet>,
  ));
}


}

// dart format on
